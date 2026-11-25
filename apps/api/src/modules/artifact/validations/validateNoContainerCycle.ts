/**
 * @atlas
 * @kind validation
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import { ArtifactKind } from '@template/db/generated/client/enums';
import { ARTIFACT_MAX_DEPTH, containerArtifactKinds } from '@template/shared/artifact';
import { makeError } from '#/lib/errors';

export const validateNoContainerCycle = async (
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
