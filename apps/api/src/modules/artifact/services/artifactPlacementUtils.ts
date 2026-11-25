/**
 * @atlas
 * @kind utils
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import { db, type Prisma } from '@template/db';
import type { Artifact, ArtifactPlacement } from '@template/db/generated/client/client';
import { type ArtifactAccess, ArtifactKind } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import { ARTIFACT_MAX_CHILDREN, isContainerKind } from '@template/shared/artifact';
import { makeError } from '#/lib/errors';
import {
  lockArtifactsInTxn,
  ownerColumns,
  sameArtifactOwner,
} from '#/modules/artifact/services/artifactOwner';
import { ensureOwnerRootArtifact } from '#/modules/artifact/services/ownerRootArtifact';
import { validateArtifactCreateAtOwner } from '#/modules/artifact/validations/validateArtifactCreateAtOwner';
import { validateArtifactPermission } from '#/modules/artifact/validations/validateArtifactPermission';
import { validateContainable } from '#/modules/artifact/validations/validateContainable';
import { validateNoContainerCycle } from '#/modules/artifact/validations/validateNoContainerCycle';
import {
  defaultPlacementAccess,
  validatePlacementAccess,
} from '#/modules/artifact/validations/validatePlacementAccess';

export type CreateArtifactInput = Omit<Prisma.ArtifactUncheckedCreateInput, 'effectiveAccess'> & {
  access?: ArtifactAccess;
  containerArtifactId?: string;
};

export const fetchArtifactOrThrow = async (artifactId: string): Promise<Artifact> => {
  const artifact = await db.artifact.findUnique({ where: { id: artifactId } });
  if (!artifact) throw makeError({ status: 404, message: 'Artifact not found' });
  return artifact;
};

export const writePlacement = async (
  artifact: Artifact,
  container: Artifact,
  access?: ArtifactAccess,
): Promise<ArtifactPlacement> => {
  validateContainable(container, artifact);
  const resolvedAccess = access ?? defaultPlacementAccess(container);
  validatePlacementAccess(container, resolvedAccess);
  if (isContainerKind(artifact.kind)) await validateNoContainerCycle(container.id, artifact.id);
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
      artifactId: artifact.id,
      containerArtifactId: container.id,
      access: resolvedAccess,
    },
  });
};

export const insertArtifact = async (
  { containerArtifactId, access, ...data }: CreateArtifactInput,
  permix?: Permix,
  prelockedContainer?: Artifact,
): Promise<Artifact> => {
  const candidateOwner = ownerColumns(data);
  let container: Artifact;
  let resolvedAccess: ArtifactAccess;
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
    resolvedAccess = access ?? defaultPlacementAccess(container);
    validatePlacementAccess(container, resolvedAccess);
    if (permix) {
      const needsManage = resolvedAccess !== defaultPlacementAccess(container);
      await validateArtifactPermission(permix, container, needsManage ? 'manage' : 'operate');
    }
    validateContainable(container, { id: '', kind: data.kind });
  } else {
    resolvedAccess = access ?? 'private';
    validatePlacementAccess({ kind: ArtifactKind.root }, resolvedAccess);
    if (permix && resolvedAccess !== 'private') {
      await validateArtifactCreateAtOwner(permix, ArtifactKind.root, candidateOwner, 'manage');
    }
    container = await ensureOwnerRootArtifact(candidateOwner);
  }

  const artifact = await db.artifact.create({
    data: { ...data, effectiveAccess: 'private' },
  });
  await writePlacement(artifact, container, resolvedAccess);
  return db.artifact.findUniqueOrThrow({ where: { id: artifact.id } });
};
