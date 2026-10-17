/**
 * @atlas
 * @kind validator
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import { makeError } from '#/lib/errors';
import { listOwnContainerPlacements } from '#/modules/artifact/services/listOwnPlacements';
import { resolveArtifactAccess } from '#/modules/artifact/services/resolveArtifactAccess';

export const assertKeepsOwnersOnlyReach = async (
  artifactIds: string[],
  leavingContainerArtifactId: string,
): Promise<void> => {
  if (artifactIds.length === 0) return;
  const resolutions = await resolveArtifactAccess(artifactIds);
  for (const { artifactId, ownersOnly } of resolutions.values()) {
    if (!ownersOnly) continue;
    const artifact = await db.artifact.findUniqueOrThrow({ where: { id: artifactId } });
    const remaining = (await listOwnContainerPlacements(artifact)).filter(
      (placement) => placement.containerArtifactId !== leavingContainerArtifactId,
    );
    if (remaining.length === 0) {
      throw makeError({
        status: 422,
        message:
          "Org-user content must keep a container of its owner: place it in another of the org's containers first (that shares it), or delete it",
      });
    }
  }
};
