/**
 * @atlas
 * @kind validator
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { findReferenceCycle } from '@template/shared/graph';
import { makeError } from '#/lib/errors';
import { fetchArtifactAncestorDepth } from '#/modules/artifact/services/fetchArtifactAncestorDepth';
import { fetchArtifactDescendants } from '#/modules/artifact/services/fetchArtifactDescendants';
import { ARTIFACT_MAX_DEPTH } from '#/modules/artifact/services/fetchArtifactGraph';

export const assertNoContainerCycle = async (
  containerArtifactId: string,
  artifactId: string,
): Promise<void> => {
  const { contents, height } = await fetchArtifactDescendants(artifactId, ARTIFACT_MAX_DEPTH + 1);
  const candidate = new Map(contents);
  candidate.set(
    containerArtifactId,
    new Set([...(contents.get(containerArtifactId) ?? []), artifactId]),
  );
  const cycle = findReferenceCycle(candidate, containerArtifactId);
  if (cycle) {
    throw makeError({
      status: 422,
      message: `Containers would form a loop: ${cycle.join(' -> ')}`,
    });
  }
  if ((await fetchArtifactAncestorDepth(containerArtifactId)) + 1 + height > ARTIFACT_MAX_DEPTH) {
    throw makeError({
      status: 422,
      message: `Containers nest at most ${ARTIFACT_MAX_DEPTH} deep`,
    });
  }
};
