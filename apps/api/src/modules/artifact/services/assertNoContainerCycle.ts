/**
 * @atlas
 * @kind validator
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { findReferenceCycle } from '@template/shared/graph';
import { makeError } from '#/lib/errors';
import { artifactAncestorDepth } from '#/modules/artifact/services/artifactAncestorDepth';
import { listArtifactDescendants } from '#/modules/artifact/services/listArtifactDescendants';
import { ARTIFACT_MAX_DEPTH } from '#/modules/artifact/services/loadArtifactGraph';

export const assertNoContainerCycle = async (
  containerArtifactId: string,
  artifactId: string,
): Promise<void> => {
  const { members, height } = await listArtifactDescendants(artifactId, ARTIFACT_MAX_DEPTH + 1);
  const candidate = new Map(members);
  candidate.set(
    containerArtifactId,
    new Set([...(members.get(containerArtifactId) ?? []), artifactId]),
  );
  const cycle = findReferenceCycle(candidate, containerArtifactId);
  if (cycle) {
    throw makeError({
      status: 422,
      message: `Containers would form a loop: ${cycle.join(' -> ')}`,
    });
  }
  if ((await artifactAncestorDepth(containerArtifactId)) + 1 + height > ARTIFACT_MAX_DEPTH) {
    throw makeError({
      status: 422,
      message: `Containers nest at most ${ARTIFACT_MAX_DEPTH} deep`,
    });
  }
};
