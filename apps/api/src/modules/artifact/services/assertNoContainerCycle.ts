/**
 * @atlas
 * @kind validator
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import { ARTIFACT_MAX_DEPTH } from '#/hooks/artifactTree/syncArtifactTree';
import { makeError } from '#/lib/errors';

export const assertNoContainerCycle = async (
  containerArtifactId: string,
  artifactId: string,
): Promise<void> => {
  if (containerArtifactId === artifactId) {
    throw makeError({
      status: 422,
      message: `Containers would form a loop: ${containerArtifactId} -> ${artifactId}`,
    });
  }
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
  const upDepth = above._max.depth ?? 0;
  const downHeight = below._max.depth ?? 0;
  if (upDepth + 1 + downHeight > ARTIFACT_MAX_DEPTH) {
    throw makeError({
      status: 422,
      message: `Containers nest at most ${ARTIFACT_MAX_DEPTH} deep`,
    });
  }
};
