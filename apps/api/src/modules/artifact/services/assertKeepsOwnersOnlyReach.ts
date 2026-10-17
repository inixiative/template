/**
 * @atlas
 * @kind validator
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import { makeError } from '#/lib/errors';
import { resolveArtifactAccess } from '#/modules/artifact/services/resolveArtifactAccess';

export const assertKeepsOwnersOnlyReach = async (artifactIds: string[]): Promise<void> => {
  if (artifactIds.length === 0) return;
  const resolutions = await resolveArtifactAccess(artifactIds);
  const ownersOnly = [...resolutions.values()].filter((resolution) => resolution.ownersOnly);
  for (const { artifactId } of ownersOnly) {
    if ((await db.artifactContainer.count({ where: { artifactId } })) <= 1) {
      throw makeError({
        status: 422,
        message:
          "Org-user content can't be left in no container: place it in another container first (that shares it), or delete it",
      });
    }
  }
};
