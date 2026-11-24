/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex, primitive:authz
 */
import { db, type Prisma } from '@template/db';
import type { Artifact, ArtifactPlacement } from '@template/db/generated/client/client';
import type { ArtifactAccess } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import { ARTIFACT_MAX_DEPTH, artifactKindDef, canContain } from '@template/shared/artifact';
import { makeError } from '#/lib/errors';
import {
  lockArtifactsInTxn,
  type OwnedArtifact,
  ownerColumns,
  sameArtifactOwner,
  withArtifactOwnersLock,
  withLockedArtifacts,
} from '#/modules/artifact/lib/artifactOwner';
import {
  assertArtifactPermission,
  canActOnArtifact,
} from '#/modules/artifact/lib/checkArtifactPermission';

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

const fetchArtifact = async (artifactId: string): Promise<Artifact> => {
  const artifact = await db.artifact.findUnique({ where: { id: artifactId } });
  if (!artifact) throw makeError({ status: 404, message: 'Artifact not found' });
  return artifact;
};

const assertContainable = (
  container: Pick<Artifact, 'id' | 'kind'>,
  member: Pick<Artifact, 'id' | 'kind'>,
): void => {
  if (container.id === member.id) {
    throw makeError({ status: 422, message: 'An artifact cannot contain itself' });
  }
  if (!canContain(container.kind, member.kind)) {
    throw makeError({
      status: 422,
      message: `A ${container.kind} cannot contain a ${member.kind}`,
    });
  }
};

const assertNoContainerCycle = async (
  containerArtifactId: string,
  artifactId: string,
): Promise<void> => {
  const existingCycle = await db.artifactAncestor.findFirst({
    where: { artifactId: containerArtifactId, ancestorArtifactId: artifactId },
    select: { id: true },
  });
  if (existingCycle) {
    throw makeError({
      status: 422,
      message: `Containers would form a loop: ${containerArtifactId} -> ${artifactId}`,
    });
  }
  const above = await db.artifactAncestor.aggregate({
    where: { artifactId: containerArtifactId },
    _max: { depth: true },
  });
  const below = await db.artifactAncestor.aggregate({
    where: { ancestorArtifactId: artifactId, artifact: { type: 'container' } },
    _max: { depth: true },
  });
  if ((above._max.depth ?? 0) + 1 + (below._max.depth ?? 0) > ARTIFACT_MAX_DEPTH) {
    throw makeError({
      status: 422,
      message: `Containers nest at most ${ARTIFACT_MAX_DEPTH} deep`,
    });
  }
};

const assertEdgeAuthority = async (
  permix: Permix,
  member: Artifact,
  container: Artifact,
  mode: 'create' | 'remove',
): Promise<void> => {
  if (!(await canActOnArtifact(permix, container, 'operate'))) {
    throw makeError({ status: 403, message: 'Forbidden' });
  }
  const sameOwner = sameArtifactOwner(member, container);
  if (!sameOwner && mode === 'remove') return;
  if (!(await canActOnArtifact(permix, member, sameOwner ? 'manage' : 'read'))) {
    throw makeError({ status: 403, message: 'Forbidden' });
  }
};

const hasSameOwnerPlacement = async (member: Artifact): Promise<boolean> =>
  (await db.artifactPlacement.count({
    where: { artifactId: member.id, containerArtifact: ownerColumns(member) },
  })) > 0;

const writePlacement = async (
  member: Artifact,
  container: Artifact,
  inherit: boolean | undefined,
): Promise<ArtifactPlacement> => {
  assertContainable(container, member);
  if (member.type === 'container') await assertNoContainerCycle(container.id, member.id);
  if (sameArtifactOwner(container, member)) {
    const placed = await hasSameOwnerPlacement(member);
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
  if (!placement) {
    throw makeError({ status: 404, message: 'The artifact is not in that container' });
  }
  await db.artifactPlacement.update({
    where: { id: placement.id },
    data: { deletedAt: new Date() },
  });
};

export const placeArtifact = async (
  permix: Permix,
  { artifactId, containerArtifactId, inherit }: PlaceArtifactInput,
): Promise<ArtifactPlacement> => {
  const member = await fetchArtifact(artifactId);
  const container = await fetchArtifact(containerArtifactId);
  await assertEdgeAuthority(permix, member, container, 'create');
  return withLockedArtifacts([member, container], async (locked) => {
    const lockedMember = locked.get(artifactId)!;
    const lockedContainer = locked.get(containerArtifactId)!;
    await assertEdgeAuthority(permix, lockedMember, lockedContainer, 'create');
    return writePlacement(lockedMember, lockedContainer, inherit);
  });
};

export const removeArtifactPlacement = async (
  permix: Permix,
  placement: ArtifactPlacement,
): Promise<void> => {
  const member = await fetchArtifact(placement.artifactId);
  const container = await fetchArtifact(placement.containerArtifactId);
  await assertEdgeAuthority(permix, member, container, 'remove');
  await withLockedArtifacts([member, container], async (locked) => {
    const current = await db.artifactPlacement.findUnique({ where: { id: placement.id } });
    if (!current) {
      throw makeError({ status: 404, message: 'The artifact is not in that container' });
    }
    await assertEdgeAuthority(
      permix,
      locked.get(current.artifactId)!,
      locked.get(current.containerArtifactId)!,
      'remove',
    );
    await db.artifactPlacement.update({
      where: { id: current.id },
      data: { deletedAt: new Date() },
    });
  });
};

export const moveArtifact = async (
  permix: Permix,
  { artifactId, fromContainerArtifactId, toContainerArtifactId }: MoveArtifactInput,
): Promise<Artifact> => {
  const assertMoveAuthority = async (
    member: Artifact,
    fromContainer?: Artifact,
    toContainer?: Artifact,
  ) => {
    if (fromContainer) {
      await assertEdgeAuthority(permix, member, fromContainer, 'remove');
      // why: cross-owner remove skips member auth only when the edge actually sits in fromContainer.
      if (!sameArtifactOwner(member, fromContainer)) {
        const edge = await db.artifactPlacement.findFirst({
          where: { artifactId: member.id, containerArtifactId: fromContainer.id },
          select: { id: true },
        });
        if (!edge) {
          if (!(await canActOnArtifact(permix, member, 'read'))) {
            throw makeError({ status: 403, message: 'Forbidden' });
          }
          throw makeError({ status: 404, message: 'The artifact is not in that container' });
        }
      }
    }
    if (toContainer) await assertEdgeAuthority(permix, member, toContainer, 'create');
    if (!fromContainer && !toContainer) {
      if (!(await canActOnArtifact(permix, member, 'manage'))) {
        throw makeError({ status: 403, message: 'Forbidden' });
      }
    }
  };

  const member = await fetchArtifact(artifactId);
  const fromContainer = fromContainerArtifactId
    ? await fetchArtifact(fromContainerArtifactId)
    : undefined;
  const toContainer = toContainerArtifactId
    ? await fetchArtifact(toContainerArtifactId)
    : undefined;
  await assertMoveAuthority(member, fromContainer, toContainer);
  if (fromContainerArtifactId === toContainerArtifactId) {
    throw makeError({ status: 422, message: 'A move needs a different destination' });
  }

  const lockTargets = [
    member,
    ...(fromContainer ? [fromContainer] : []),
    ...(toContainer ? [toContainer] : []),
  ];
  return withLockedArtifacts(lockTargets, async (locked) => {
    const lockedMember = locked.get(artifactId)!;
    const lockedFrom = fromContainerArtifactId ? locked.get(fromContainerArtifactId)! : undefined;
    const lockedTo = toContainerArtifactId ? locked.get(toContainerArtifactId)! : undefined;
    await assertMoveAuthority(lockedMember, lockedFrom, lockedTo);
    if (lockedTo) await writePlacement(lockedMember, lockedTo, undefined);
    if (lockedFrom) await removePlacement(artifactId, lockedFrom.id);
    return db.artifact.findUniqueOrThrow({ where: { id: artifactId } });
  });
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
    const locked = await lockArtifactsInTxn([containerArtifactId]);
    container = locked.get(containerArtifactId)!;
    if (permix && !(await canActOnArtifact(permix, container, 'operate'))) {
      throw makeError({ status: 403, message: 'Forbidden' });
    }
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
  return artifact;
};

export const createArtifact = async (
  permix: Permix,
  input: CreateArtifactInput,
): Promise<Artifact> => {
  const lockTargets: OwnedArtifact[] = [ownerColumns(input)];
  if (input.containerArtifactId) {
    const container = await assertArtifactPermission(permix, input.containerArtifactId, 'operate');
    lockTargets.push(container);
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
  const source = await assertArtifactPermission(permix, artifactId, 'read');
  const container = await assertArtifactPermission(permix, containerArtifactId, 'operate');
  return withLockedArtifacts([source, container], async (locked) => {
    const lockedSource = locked.get(artifactId)!;
    const lockedContainer = locked.get(containerArtifactId)!;
    if (!(await canActOnArtifact(permix, lockedSource, 'read'))) {
      throw makeError({ status: 403, message: 'Forbidden' });
    }
    if (!(await canActOnArtifact(permix, lockedContainer, 'operate'))) {
      throw makeError({ status: 403, message: 'Forbidden' });
    }
    const resolvedGrant =
      typeof creatorGrant === 'function' ? creatorGrant(lockedContainer) : creatorGrant;
    return copyArtifactInto(lockedSource, lockedContainer, {
      containerArtifactId: lockedContainer.id,
      name,
      creatorGrant: resolvedGrant,
    });
  });
};
