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
import { withLockedArtifacts } from '#/modules/artifact/services/artifactOwner';
import { validateContainable } from '#/modules/artifact/validations/validateContainable';
import { validateNoContainerCycle } from '#/modules/artifact/validations/validateNoContainerCycle';
import {
  defaultPlacementAccess,
  validatePlacementAccess,
} from '#/modules/artifact/validations/validatePlacementAccess';

export const fetchArtifactOrThrow = async (artifactId: string): Promise<Artifact> => {
  const artifact = await db.artifact.findUnique({ where: { id: artifactId } });
  if (!artifact) throw makeError({ status: 404, message: 'Artifact not found' });
  return artifact;
};

export const withLockedPlacement = <T>(
  placement: ArtifactPlacement,
  artifact: Artifact,
  container: Artifact,
  extraArtifacts: Artifact[],
  fn: (ctx: {
    current: ArtifactPlacement;
    lockedArtifact: Artifact;
    lockedContainer: Artifact;
    locked: Map<string, Artifact>;
  }) => Promise<T>,
): Promise<T> =>
  withLockedArtifacts([artifact, container, ...extraArtifacts], async (locked) => {
    const current = await db.artifactPlacement.findUnique({ where: { id: placement.id } });
    if (!current) throw makeError({ status: 404, message: 'Artifact placement not found' });
    if (current.containerArtifactId !== container.id) {
      throw makeError({
        status: 409,
        message: 'Artifact placement changed while waiting for lock; please retry',
      });
    }
    return fn({
      current,
      lockedArtifact: locked.get(current.artifactId)!,
      lockedContainer: locked.get(container.id)!,
      locked,
    });
  });

export const validatePlacementTarget = async (
  artifact: Artifact,
  container: Artifact,
  access?: ArtifactAccess,
): Promise<ArtifactAccess> => {
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
  return resolvedAccess;
};

export const writePlacement = async (
  artifact: Artifact,
  container: Artifact,
  access?: ArtifactAccess,
): Promise<ArtifactPlacement> => {
  const resolvedAccess = await validatePlacementTarget(artifact, container, access);
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
