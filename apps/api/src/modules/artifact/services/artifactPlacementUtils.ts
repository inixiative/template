/**
 * @atlas
 * @kind utils
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import { db, type Prisma } from '@template/db';
import type { Artifact, ArtifactPlacement } from '@template/db/generated/client/client';
import type { ArtifactAccess } from '@template/db/generated/client/enums';
import { ARTIFACT_MAX_CHILDREN, isContainerKind, isRootKind } from '@template/shared/artifact';
import { makeError } from '#/lib/errors';
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
  if (isContainerKind(artifact.kind) && !isRootKind(container.kind)) {
    await validateNoContainerCycle(container.id, artifact.id);
  }
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
  data: Omit<Prisma.ArtifactUncheckedCreateInput, 'effectiveAccess'>,
  container: Artifact,
  access?: ArtifactAccess,
): Promise<Artifact> => {
  const artifact = await db.artifact.create({
    data: { ...data, effectiveAccess: 'private' },
  });
  await writePlacement(artifact, container, access);
  return db.artifact.findUniqueOrThrow({ where: { id: artifact.id } });
};
