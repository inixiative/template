/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex
 */
import { db, type Prisma } from '@template/db';
import type { Artifact, ArtifactPlacement } from '@template/db/generated/client/client';
import type { ArtifactAccess } from '@template/db/generated/client/enums';
import { artifactKindDef } from '@template/shared/artifact';
import { makeError } from '#/lib/errors';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';
import type { ArtifactActor } from '#/modules/artifact/lib/artifactActor';
import { ARTIFACT_EDGE_AUTHORITY } from '#/modules/artifact/lib/artifactEdgeAuthority';
import {
  artifactOwner,
  type OwnedArtifact,
  ownerColumns,
} from '#/modules/artifact/lib/artifactOwner';
import { assertArtifactAction } from '#/modules/artifact/lib/assertArtifactAction';
import { assertContainable } from '#/modules/artifact/lib/assertContainable';
import { assertEdgeAuthority } from '#/modules/artifact/lib/assertEdgeAuthority';
import { assertKeepsMemberScope } from '#/modules/artifact/services/assertKeepsMemberScope';
import { assertNoContainerCycle } from '#/modules/artifact/services/assertNoContainerCycle';
import { checkArtifactAccess } from '#/modules/artifact/services/checkArtifactAccess';

export type PlaceArtifactInput = {
  artifactId: string;
  containerArtifactId: string;
  inherit?: boolean;
};

export type MoveArtifactInput = {
  artifactId: string;
  fromContainerArtifactId?: string;
  toContainerArtifactId?: string;
};

export type CreatorGrant = Omit<
  Prisma.ArtifactPermissionUncheckedCreateInput,
  'artifactId' | 'role'
>;

export type CreateArtifactInput = Omit<Prisma.ArtifactUncheckedCreateInput, 'access' | 'type'> & {
  access?: ArtifactAccess;
  containerArtifactId?: string;
  creatorGrant?: CreatorGrant;
};

export type CopyArtifactInput = {
  artifactId: string;
  containerArtifactId: string;
  name?: string;
  creatorGrant?: CreatorGrant | ((container: Artifact) => CreatorGrant | undefined);
};

const assertAction = async (
  actor: ArtifactActor,
  artifactId: string,
  action: 'read' | 'operate' | 'manage',
) => {
  const verdicts = await checkArtifactAccess(actor, [artifactId], action);
  assertArtifactAction(verdicts.get(artifactId), action);
};

const lockArtifacts = async (ids: string[]): Promise<Map<string, Artifact>> => {
  const sorted = [...new Set(ids)].sort();
  const locked = new Map<string, Artifact>();
  for (const id of sorted) {
    const [row] = await db.findForUpdate<Artifact>('Artifact', { id });
    if (!row || row.deletedAt) throw makeError({ status: 404, message: 'Artifact not found' });
    locked.set(id, row);
  }
  return locked;
};

const fetchArtifact = async (artifactId: string) => {
  const artifact = await db.artifact.findUnique({ where: { id: artifactId } });
  if (!artifact) throw makeError({ status: 404, message: 'Artifact not found' });
  return artifact;
};

const hasPlacement = async (artifactId: string): Promise<boolean> =>
  (await db.artifactPlacement.count({ where: { artifactId } })) > 0;

const writePlacement = async (
  member: Artifact,
  container: Artifact,
  inherit: boolean | undefined,
): Promise<ArtifactPlacement> => {
  assertContainable(container, member);
  if (member.type === 'container') await assertNoContainerCycle(container.id, member.id);
  const placed = await hasPlacement(member.id);
  if (inherit === false && member.access === 'inherit' && !placed) {
    await db.artifact.update({
      where: { id: member.id },
      data: { access: artifactKindDef(member.kind)?.defaultAccess ?? 'private' },
    });
  }
  const placement = await db.artifactPlacement.create({
    data: { artifactId: member.id, containerArtifactId: container.id },
  });
  if ((inherit ?? !placed) && member.access !== 'inherit') {
    await db.artifact.update({ where: { id: member.id }, data: { access: 'inherit' } });
  }
  return placement;
};

const removePlacement = async (artifactId: string, containerArtifactId: string) => {
  const placement = await db.artifactPlacement.findFirst({
    where: { artifactId, containerArtifactId },
  });
  if (!placement)
    throw makeError({ status: 404, message: 'The artifact is not in that container' });
  await assertKeepsMemberScope([artifactId], containerArtifactId);
  await db.artifactPlacement.update({
    where: { id: placement.id },
    data: { deletedAt: new Date() },
  });
};

export const placeArtifact = async (
  actor: ArtifactActor,
  { artifactId, containerArtifactId, inherit }: PlaceArtifactInput,
): Promise<ArtifactPlacement> => {
  await assertEdgeAuthority(actor, artifactId, containerArtifactId);
  const member = await fetchArtifact(artifactId);
  return withOwnerLock(artifactOwner(member), 'containers', () =>
    db.txn(async () => {
      const locked = await lockArtifacts([artifactId, containerArtifactId]);
      await assertEdgeAuthority(actor, artifactId, containerArtifactId);
      return writePlacement(locked.get(artifactId)!, locked.get(containerArtifactId)!, inherit);
    }),
  );
};

export const moveArtifact = async (
  actor: ArtifactActor,
  { artifactId, fromContainerArtifactId, toContainerArtifactId }: MoveArtifactInput,
): Promise<Artifact> => {
  const assertMoveAuthority = async () => {
    if (fromContainerArtifactId)
      await assertEdgeAuthority(actor, artifactId, fromContainerArtifactId);
    if (toContainerArtifactId) await assertEdgeAuthority(actor, artifactId, toContainerArtifactId);
    if (!fromContainerArtifactId)
      await assertAction(actor, artifactId, ARTIFACT_EDGE_AUTHORITY.member);
  };
  await assertMoveAuthority();
  if (fromContainerArtifactId === toContainerArtifactId) {
    throw makeError({ status: 422, message: 'A move needs a different destination' });
  }
  const member = await fetchArtifact(artifactId);

  return withOwnerLock(artifactOwner(member), 'containers', () =>
    db.txn(async () => {
      const idsToLock = [
        artifactId,
        ...(toContainerArtifactId ? [toContainerArtifactId] : []),
        ...(fromContainerArtifactId ? [fromContainerArtifactId] : []),
      ];
      const locked = await lockArtifacts(idsToLock);
      await assertMoveAuthority();
      if (toContainerArtifactId) {
        await writePlacement(
          locked.get(artifactId)!,
          locked.get(toContainerArtifactId)!,
          undefined,
        );
      }
      if (fromContainerArtifactId) await removePlacement(artifactId, fromContainerArtifactId);
      return db.artifact.findUniqueOrThrow({ where: { id: artifactId } });
    }),
  );
};

const insertArtifact = async (
  { containerArtifactId, access, creatorGrant, ...data }: CreateArtifactInput,
  actor?: ArtifactActor,
): Promise<Artifact> => {
  const kind = artifactKindDef(data.kind);
  if (!kind) throw makeError({ status: 422, message: `Unknown artifact kind: ${data.kind}` });

  const candidateOwner = ownerColumns(data);
  let container: Artifact | null = null;
  if (containerArtifactId) {
    const locked = await lockArtifacts([containerArtifactId]);
    container = locked.get(containerArtifactId)!;
    if (actor) await assertAction(actor, container.id, ARTIFACT_EDGE_AUTHORITY.container);
    assertContainable(container, { ...candidateOwner, id: '', kind: data.kind });
  }

  const artifact = await db.artifact.create({
    data: {
      ...data,
      type: kind.type,
      ...(access && access !== 'inherit' ? { access } : {}),
    },
  });
  if (creatorGrant) {
    await db.artifactPermission.create({
      data: { ...creatorGrant, artifactId: artifact.id, role: 'owner' },
    });
  }
  if (container) {
    await writePlacement(artifact, container, access ? access === 'inherit' : undefined);
  }
  return db.artifact.findUniqueOrThrow({ where: { id: artifact.id } });
};

export const createArtifact = async (
  actor: ArtifactActor,
  input: CreateArtifactInput,
): Promise<Artifact> => {
  if (input.containerArtifactId) {
    await assertAction(actor, input.containerArtifactId, ARTIFACT_EDGE_AUTHORITY.container);
  }
  return withOwnerLock(artifactOwner(ownerColumns(input)), 'containers', () =>
    db.txn(() => insertArtifact(input, actor)),
  );
};

export const copyArtifactInto = async (
  source: Artifact,
  owner: OwnedArtifact,
  {
    containerArtifactId,
    name,
    creatorGrant,
  }: {
    containerArtifactId?: string;
    name?: string;
    creatorGrant?: CreatorGrant;
  },
): Promise<Artifact> => {
  const copy = await insertArtifact({
    ...ownerColumns(owner),
    kind: source.kind,
    name: name ?? source.name,
    access: containerArtifactId ? 'inherit' : 'private',
    containerArtifactId,
    creatorGrant,
  });
  if (artifactKindDef(source.kind)?.contentModel === 'File') {
    const file = await db.file.findUnique({
      where: { artifactId: source.id },
      include: { versions: { where: { status: 'active' } } },
    });
    if (file) {
      const copied = await db.file.create({ data: { artifactId: copy.id, sourceFileId: file.id } });
      for (const version of file.versions) {
        await db.fileVersion.create({
          data: {
            fileId: copied.id,
            version: version.version,
            key: version.key,
            contentType: version.contentType,
            size: version.size,
            status: 'pending',
          },
        });
      }
    }
  }
  return copy;
};

export const copyArtifact = async (
  actor: ArtifactActor,
  { artifactId, containerArtifactId, name, creatorGrant }: CopyArtifactInput,
): Promise<Artifact> => {
  await assertAction(actor, artifactId, 'read');
  await assertAction(actor, containerArtifactId, ARTIFACT_EDGE_AUTHORITY.container);
  const initialContainer = await fetchArtifact(containerArtifactId);
  return withOwnerLock(artifactOwner(initialContainer), 'containers', () =>
    db.txn(async () => {
      const locked = await lockArtifacts([artifactId, containerArtifactId]);
      const source = locked.get(artifactId)!;
      const container = locked.get(containerArtifactId)!;
      await assertAction(actor, source.id, 'read');
      await assertAction(actor, container.id, ARTIFACT_EDGE_AUTHORITY.container);
      const resolvedGrant =
        typeof creatorGrant === 'function' ? creatorGrant(container) : creatorGrant;
      return copyArtifactInto(source, container, {
        containerArtifactId: container.id,
        name,
        creatorGrant: resolvedGrant,
      });
    }),
  );
};
