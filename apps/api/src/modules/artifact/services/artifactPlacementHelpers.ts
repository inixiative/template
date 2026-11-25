/**
 * @atlas
 * @kind utils
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import { db, hydrate, type Prisma } from '@template/db';
import type { Artifact, ArtifactPlacement } from '@template/db/generated/client/client';
import { type ArtifactAccess, ArtifactKind } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import { check } from '@template/permissions/rebac';
import {
  ARTIFACT_MAX_CHILDREN,
  ARTIFACT_MAX_DEPTH,
  canContain,
  containerArtifactKinds,
  isContainerKind,
  isRootKind,
} from '@template/shared/artifact';
import { makeError } from '#/lib/errors';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import {
  lockArtifactsInTxn,
  type OwnedArtifact,
  ownerColumns,
  sameArtifactOwner,
} from '#/modules/artifact/services/artifactOwner';
import { canActOnArtifact } from '#/modules/artifact/services/checkArtifactPermission';
import { ensureOwnerRootArtifact } from '#/modules/artifact/services/ownerRootArtifact';

export type CreateArtifactInput = Omit<Prisma.ArtifactUncheckedCreateInput, 'effectiveAccess'> & {
  access?: ArtifactAccess;
  containerArtifactId?: string;
};

export const defaultPlacementAccess = (container: Pick<Artifact, 'kind'>): ArtifactAccess =>
  isRootKind(container.kind) ? 'private' : 'inherit';

export const fetchArtifact = async (artifactId: string): Promise<Artifact> => {
  const artifact = await db.artifact.findUnique({ where: { id: artifactId } });
  if (!artifact) throw makeError({ status: 404, message: 'Artifact not found' });
  return artifact;
};

export const assertContainable = (
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

export const assertPlacementAccessValid = (
  container: Pick<Artifact, 'kind'>,
  access: ArtifactAccess,
): void => {
  if (isRootKind(container.kind) && access === 'inherit') {
    throw makeError({
      status: 422,
      message: 'Root placements cannot use inherit access; choose private, tenant, or public',
    });
  }
};

export const assertNoContainerCycle = async (
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
    where: {
      artifactId: containerArtifactId,
      ancestorArtifact: { kind: { not: ArtifactKind.root } },
    },
    _max: { depth: true },
  });
  const below = await db.artifactAncestor.aggregate({
    where: { ancestorArtifactId: artifactId, artifact: { kind: { in: containerArtifactKinds } } },
    _max: { depth: true },
  });
  if ((above._max.depth ?? 0) + 1 + (below._max.depth ?? 0) > ARTIFACT_MAX_DEPTH) {
    throw makeError({
      status: 422,
      message: `Containers nest at most ${ARTIFACT_MAX_DEPTH} deep`,
    });
  }
};

export const assertEdgeAuthority = async (
  permix: Permix,
  member: Artifact,
  container: Artifact,
  mode: 'create' | 'remove' | 'manage',
  access?: ArtifactAccess,
): Promise<void> => {
  const isCustomAccess =
    mode === 'create' && access !== undefined && access !== defaultPlacementAccess(container);
  if (mode === 'create' && isRootKind(container.kind)) {
    const canCreateAtRoot = await holdsOnRecord(
      permix,
      'artifact',
      { id: '', kind: ArtifactKind.root, effectiveAccess: 'private', ...ownerColumns(container) },
      'create',
    );
    if (!canCreateAtRoot) throw makeError({ status: 403, message: 'Forbidden' });
  }
  const containerAction = mode === 'manage' || isCustomAccess ? 'manage' : 'operate';
  if (!(await canActOnArtifact(permix, container, containerAction))) {
    throw makeError({ status: 403, message: 'Forbidden' });
  }
  const sameOwner = sameArtifactOwner(member, container);
  if (!sameOwner && mode === 'remove') return;
  if (!(await canActOnArtifact(permix, member, sameOwner ? 'manage' : 'read'))) {
    throw makeError({ status: 403, message: 'Forbidden' });
  }
};

export const assertPlacementDeletable = async (
  permix: Permix,
  placement: ArtifactPlacement,
): Promise<void> => {
  const hydrated = await hydrate('artifactPlacement', placement);
  if (!check(permix, 'artifactPlacement', hydrated, 'delete')) {
    throw makeError({ status: 403, message: 'Forbidden' });
  }
};

export const writePlacement = async (
  member: Artifact,
  container: Artifact,
  access?: ArtifactAccess,
): Promise<ArtifactPlacement> => {
  assertContainable(container, member);
  const resolvedAccess = access ?? defaultPlacementAccess(container);
  assertPlacementAccessValid(container, resolvedAccess);
  if (isContainerKind(member.kind)) await assertNoContainerCycle(container.id, member.id);
  const childCount = await db.artifactPlacement.count({
    where: { containerArtifactId: container.id },
  });
  if (childCount >= ARTIFACT_MAX_CHILDREN) {
    throw makeError({
      status: 422,
      message: `A container can hold at most ${ARTIFACT_MAX_CHILDREN} direct items`,
    });
  }
  return db.artifactPlacement.create({
    data: {
      artifactId: member.id,
      containerArtifactId: container.id,
      access: resolvedAccess,
    },
  });
};

export const reparentOrphanedOwnedArtifacts = async (
  owner: OwnedArtifact,
  candidateIds: string[],
): Promise<void> => {
  const uniqueIds = [...new Set(candidateIds)];
  if (uniqueIds.length === 0) return;

  const ownerFields = ownerColumns(owner);
  const orphans = await db.artifact.findMany({
    where: {
      id: { in: uniqueIds },
      ...ownerFields,
      kind: { not: ArtifactKind.root },
      placements: { none: { containerArtifact: ownerFields } },
    },
    select: { id: true },
  });
  if (orphans.length === 0) return;

  const root = await ensureOwnerRootArtifact(ownerFields);
  await db.artifactPlacement.createManyAndReturn({
    data: orphans.map(({ id }) => ({
      containerArtifactId: root.id,
      artifactId: id,
      access: 'private' as const,
    })),
    skipDuplicates: true,
  });
};

export const insertArtifact = async (
  { containerArtifactId, access, ...data }: CreateArtifactInput,
  permix?: Permix,
  prelockedContainer?: Artifact,
): Promise<Artifact> => {
  const candidateOwner = ownerColumns(data);
  let container: Artifact;
  if (containerArtifactId) {
    const locked = await lockArtifactsInTxn([containerArtifactId]);
    container = locked.get(containerArtifactId)!;
    if (prelockedContainer && !sameArtifactOwner(container, prelockedContainer)) {
      throw makeError({
        status: 409,
        message: 'Artifact ownership changed while waiting for lock; please retry',
      });
    }
    if (!sameArtifactOwner(container, candidateOwner)) {
      throw makeError({
        status: 422,
        message: 'Cannot create an artifact directly inside another owner container',
      });
    }
    const resolvedAccess = access ?? defaultPlacementAccess(container);
    assertPlacementAccessValid(container, resolvedAccess);
    if (permix) {
      const needsManage = resolvedAccess !== defaultPlacementAccess(container);
      if (!(await canActOnArtifact(permix, container, needsManage ? 'manage' : 'operate'))) {
        throw makeError({ status: 403, message: 'Forbidden' });
      }
    }
    assertContainable(container, { id: '', kind: data.kind });
  } else {
    const resolvedAccess = access ?? 'private';
    assertPlacementAccessValid({ kind: ArtifactKind.root }, resolvedAccess);
    if (permix && resolvedAccess !== 'private') {
      const canManageRoot = await holdsOnRecord(
        permix,
        'artifact',
        { id: '', kind: ArtifactKind.root, effectiveAccess: 'private', ...candidateOwner },
        'manage',
      );
      if (!canManageRoot) throw makeError({ status: 403, message: 'Forbidden' });
    }
    container = await ensureOwnerRootArtifact(candidateOwner);
  }

  const resolvedAccess = access ?? defaultPlacementAccess(container);
  assertPlacementAccessValid(container, resolvedAccess);

  const artifact = await db.artifact.create({
    data: { ...data, effectiveAccess: 'private' },
  });
  await writePlacement(artifact, container, resolvedAccess);
  return db.artifact.findUniqueOrThrow({ where: { id: artifact.id } });
};
