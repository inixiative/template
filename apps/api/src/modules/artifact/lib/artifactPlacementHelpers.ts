/**
 * @atlas
 * @kind utils
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import { db, type Prisma } from '@template/db';
import type { Artifact, ArtifactPlacement } from '@template/db/generated/client/client';
import type { ArtifactAccess } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import {
  ARTIFACT_MAX_CHILDREN,
  ARTIFACT_MAX_DEPTH,
  artifactKindDef,
  canContain,
  containerArtifactKinds,
  isContainerKind,
} from '@template/shared/artifact';
import { makeError } from '#/lib/errors';
import {
  lockArtifactsInTxn,
  ownerColumns,
  sameArtifactOwner,
} from '#/modules/artifact/lib/artifactOwner';
import { canActOnArtifact } from '#/modules/artifact/lib/checkArtifactPermission';

export type CreateArtifactInput = Omit<Prisma.ArtifactUncheckedCreateInput, 'access'> & {
  access?: ArtifactAccess;
  containerArtifactId?: string;
};

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
    where: { artifactId: containerArtifactId },
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

export const writePlacement = async (
  member: Artifact,
  container: Artifact,
  inherit: boolean | undefined,
): Promise<ArtifactPlacement> => {
  assertContainable(container, member);
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
    data: {
      ...ownerColumns(container),
      artifactId: member.id,
      containerArtifactId: container.id,
    },
  });
};

export const removePlacement = async (artifactId: string, containerArtifactId: string) => {
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

export const insertArtifact = async (
  { containerArtifactId, access, ...data }: CreateArtifactInput,
  permix?: Permix,
  prelockedContainer?: Artifact,
): Promise<Artifact> => {
  const kind = artifactKindDef(data.kind);
  if (!kind) throw makeError({ status: 422, message: `Unknown artifact kind: ${data.kind}` });

  const candidateOwner = ownerColumns(data);
  let container: Artifact | null = null;
  if (containerArtifactId) {
    const locked = await lockArtifactsInTxn([containerArtifactId]);
    container = locked.get(containerArtifactId)!;
    if (prelockedContainer && !sameArtifactOwner(container, prelockedContainer)) {
      throw makeError({
        status: 409,
        message: 'Artifact ownership changed while waiting for lock; please retry',
      });
    }
    if (permix && !(await canActOnArtifact(permix, container, 'operate'))) {
      throw makeError({ status: 403, message: 'Forbidden' });
    }
    assertContainable(container, { id: '', kind: data.kind });
  }

  const sameOwner = container ? sameArtifactOwner(container, candidateOwner) : false;
  const resolvedAccess = access ?? (sameOwner ? 'inherit' : kind.defaultAccess);
  const artifact = await db.artifact.create({
    data: { ...data, access: resolvedAccess },
  });
  if (container) {
    await writePlacement(artifact, container, access ? access === 'inherit' : undefined);
  }
  return artifact;
};
