/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex
 */
import { db, type Prisma } from '@template/db';
import type { Artifact, ArtifactPlacement } from '@template/db/generated/client/client';
import type { ArtifactAccess } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import { artifactKindDef } from '@template/shared/artifact';
import { makeError } from '#/lib/errors';
import {
  type OwnedArtifact,
  ownerColumns,
  sameArtifactOwner,
  withArtifactOwnersLock,
} from '#/modules/artifact/lib/artifactOwner';
import { assertContainable } from '#/modules/artifact/lib/assertContainable';
import { assertEdgeAuthority } from '#/modules/artifact/lib/assertEdgeAuthority';
import { assertArtifactPermission } from '#/modules/artifact/lib/checkArtifactPermission';
import { assertNoContainerCycle } from '#/modules/artifact/services/assertNoContainerCycle';

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
  if (sameArtifactOwner(container, member)) {
    const placed = await hasPlacement(member.id);
    if (inherit === false && member.access === 'inherit' && !placed) {
      await db.artifact.update({
        where: { id: member.id },
        data: { access: artifactKindDef(member.kind)?.defaultAccess ?? 'private' },
      });
    } else if ((inherit ?? !placed) && member.access !== 'inherit') {
      await db.artifact.update({ where: { id: member.id }, data: { access: 'inherit' } });
    }
  }
  return db.artifactPlacement.create({
    data: { artifactId: member.id, containerArtifactId: container.id },
  });
};

const removePlacement = async (artifactId: string, containerArtifactId: string) => {
  const placement = await db.artifactPlacement.findFirst({
    where: { artifactId, containerArtifactId },
  });
  if (!placement)
    throw makeError({ status: 404, message: 'The artifact is not in that container' });
  await db.artifactPlacement.update({
    where: { id: placement.id },
    data: { deletedAt: new Date() },
  });
};

export const placeArtifact = async (
  permix: Permix,
  { artifactId, containerArtifactId, inherit }: PlaceArtifactInput,
): Promise<ArtifactPlacement> => {
  await assertEdgeAuthority(permix, artifactId, containerArtifactId, 'create');
  const member = await fetchArtifact(artifactId);
  const container = await fetchArtifact(containerArtifactId);
  return withArtifactOwnersLock([member, container], () =>
    db.txn(async () => {
      const locked = await lockArtifacts([artifactId, containerArtifactId]);
      await assertEdgeAuthority(
        permix,
        locked.get(artifactId)!,
        locked.get(containerArtifactId)!,
        'create',
      );
      return writePlacement(locked.get(artifactId)!, locked.get(containerArtifactId)!, inherit);
    }),
  );
};

export const moveArtifact = async (
  permix: Permix,
  { artifactId, fromContainerArtifactId, toContainerArtifactId }: MoveArtifactInput,
): Promise<Artifact> => {
  const assertMoveAuthority = async (locked?: Map<string, Artifact>) => {
    const member = locked?.get(artifactId) ?? artifactId;
    if (fromContainerArtifactId) {
      await assertEdgeAuthority(
        permix,
        member,
        locked?.get(fromContainerArtifactId) ?? fromContainerArtifactId,
        'remove',
      );
    }
    if (toContainerArtifactId) {
      await assertEdgeAuthority(
        permix,
        member,
        locked?.get(toContainerArtifactId) ?? toContainerArtifactId,
        'create',
      );
    }
    if (!fromContainerArtifactId && !toContainerArtifactId) {
      await assertArtifactPermission(permix, artifactId, 'manage');
    }
  };
  await assertMoveAuthority();
  if (fromContainerArtifactId === toContainerArtifactId) {
    throw makeError({ status: 422, message: 'A move needs a different destination' });
  }
  const member = await fetchArtifact(artifactId);
  const lockTargets: OwnedArtifact[] = [member];
  if (fromContainerArtifactId) lockTargets.push(await fetchArtifact(fromContainerArtifactId));
  if (toContainerArtifactId) lockTargets.push(await fetchArtifact(toContainerArtifactId));

  return withArtifactOwnersLock(lockTargets, () =>
    db.txn(async () => {
      const idsToLock = [
        artifactId,
        ...(toContainerArtifactId ? [toContainerArtifactId] : []),
        ...(fromContainerArtifactId ? [fromContainerArtifactId] : []),
      ];
      const locked = await lockArtifacts(idsToLock);
      await assertMoveAuthority(locked);
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
  permix?: Permix,
): Promise<Artifact> => {
  const kind = artifactKindDef(data.kind);
  if (!kind) throw makeError({ status: 422, message: `Unknown artifact kind: ${data.kind}` });

  const candidateOwner = ownerColumns(data);
  let container: Artifact | null = null;
  if (containerArtifactId) {
    const locked = await lockArtifacts([containerArtifactId]);
    container = locked.get(containerArtifactId)!;
    if (permix) await assertArtifactPermission(permix, container.id, 'operate');
    assertContainable(container, { id: '', kind: data.kind });
  }

  const sameOwner = container ? sameArtifactOwner(container, candidateOwner) : false;
  const resolvedAccess = access ?? (sameOwner ? 'inherit' : kind.defaultAccess);
  const artifact = await db.artifact.create({
    data: {
      ...data,
      type: kind.type,
      access: resolvedAccess,
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
  permix: Permix,
  input: CreateArtifactInput,
): Promise<Artifact> => {
  const lockTargets: OwnedArtifact[] = [ownerColumns(input)];
  if (input.containerArtifactId) {
    await assertArtifactPermission(permix, input.containerArtifactId, 'operate');
    lockTargets.push(await fetchArtifact(input.containerArtifactId));
  }
  return withArtifactOwnersLock(lockTargets, () => db.txn(() => insertArtifact(input, permix)));
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
  permix: Permix,
  { artifactId, containerArtifactId, name, creatorGrant }: CopyArtifactInput,
): Promise<Artifact> => {
  await assertArtifactPermission(permix, artifactId, 'read');
  await assertArtifactPermission(permix, containerArtifactId, 'operate');
  const initialContainer = await fetchArtifact(containerArtifactId);
  return withArtifactOwnersLock([initialContainer], () =>
    db.txn(async () => {
      const locked = await lockArtifacts([artifactId, containerArtifactId]);
      const source = locked.get(artifactId)!;
      const container = locked.get(containerArtifactId)!;
      await assertArtifactPermission(permix, source.id, 'read');
      await assertArtifactPermission(permix, container.id, 'operate');
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
