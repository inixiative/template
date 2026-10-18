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
  creatorGrant?: CreatorGrant;
};

const assertAction = async (
  actor: ArtifactActor,
  artifactId: string,
  action: 'read' | 'operate' | 'manage',
) => {
  const verdicts = await checkArtifactAccess(actor, [artifactId], action);
  assertArtifactAction(verdicts.get(artifactId), action);
};

const loadContainer = async (member: Artifact, containerArtifactId: string) => {
  const container = await db.artifact.findUnique({ where: { id: containerArtifactId } });
  if (!container) throw makeError({ status: 404, message: 'Artifact not found' });
  assertContainable(container, member);
  return container;
};

const hasPlacement = async (artifactId: string): Promise<boolean> =>
  (await db.artifactPlacement.count({ where: { artifactId } })) > 0;

const writePlacement = async (
  member: Artifact,
  container: Artifact,
  inherit: boolean | undefined,
): Promise<ArtifactPlacement> => {
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

const loadArtifact = async (artifactId: string) => {
  const artifact = await db.artifact.findUnique({ where: { id: artifactId } });
  if (!artifact) throw makeError({ status: 404, message: 'Artifact not found' });
  return artifact;
};

export const placeArtifact = async (
  actor: ArtifactActor,
  { artifactId, containerArtifactId, inherit }: PlaceArtifactInput,
): Promise<ArtifactPlacement> => {
  await assertEdgeAuthority(actor, artifactId, containerArtifactId);
  const member = await loadArtifact(artifactId);
  return withOwnerLock(artifactOwner(member), 'containers', () =>
    db.txn(async () =>
      writePlacement(member, await loadContainer(member, containerArtifactId), inherit),
    ),
  );
};

export const moveArtifact = async (
  actor: ArtifactActor,
  { artifactId, fromContainerArtifactId, toContainerArtifactId }: MoveArtifactInput,
): Promise<Artifact> => {
  if (fromContainerArtifactId === toContainerArtifactId) {
    throw makeError({ status: 422, message: 'A move needs a different destination' });
  }
  if (fromContainerArtifactId)
    await assertEdgeAuthority(actor, artifactId, fromContainerArtifactId);
  if (toContainerArtifactId) await assertEdgeAuthority(actor, artifactId, toContainerArtifactId);
  if (!fromContainerArtifactId)
    await assertAction(actor, artifactId, ARTIFACT_EDGE_AUTHORITY.member);
  const member = await loadArtifact(artifactId);

  return withOwnerLock(artifactOwner(member), 'containers', () =>
    db.txn(async () => {
      if (toContainerArtifactId) {
        await writePlacement(member, await loadContainer(member, toContainerArtifactId), undefined);
      }
      if (fromContainerArtifactId) await removePlacement(artifactId, fromContainerArtifactId);
      return db.artifact.findUniqueOrThrow({ where: { id: artifactId } });
    }),
  );
};

const insertArtifact = async ({
  containerArtifactId,
  access,
  creatorGrant,
  ...data
}: CreateArtifactInput): Promise<Artifact> => {
  const kind = artifactKindDef(data.kind);
  if (!kind) throw makeError({ status: 422, message: `Unknown artifact kind: ${data.kind}` });
  const artifact = await db.artifact.create({
    data: { ...data, type: kind.type, ...(access && access !== 'inherit' ? { access } : {}) },
  });
  if (creatorGrant) {
    await db.artifactPermission.create({
      data: { ...creatorGrant, artifactId: artifact.id, role: 'owner' },
    });
  }
  if (containerArtifactId) {
    const container = await loadContainer(artifact, containerArtifactId);
    await writePlacement(artifact, container, (access ?? 'inherit') === 'inherit');
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
    db.txn(() => insertArtifact(input)),
  );
};

export const copyArtifactInto = async (
  source: Artifact,
  owner: OwnedArtifact,
  {
    containerArtifactId,
    name,
    creatorGrant,
  }: Omit<CopyArtifactInput, 'artifactId' | 'containerArtifactId'> & {
    containerArtifactId?: string;
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
  const [source, container] = await Promise.all([
    loadArtifact(artifactId),
    loadArtifact(containerArtifactId),
  ]);
  return withOwnerLock(artifactOwner(container), 'containers', () =>
    db.txn(() => copyArtifactInto(source, container, { containerArtifactId, name, creatorGrant })),
  );
};
