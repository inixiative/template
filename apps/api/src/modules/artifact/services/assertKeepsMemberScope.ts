/**
 * @atlas
 * @kind validator
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import { makeError } from '#/lib/errors';
import { resolveArtifactAccess } from '#/modules/artifact/services/resolveArtifactAccess';

export const assertKeepsMemberScope = async (
  artifactIds: string[],
  leavingContainerArtifactId: string,
): Promise<void> => {
  if (artifactIds.length === 0) return;
  const resolutions = await resolveArtifactAccess(artifactIds);
  for (const { artifactId, memberScoped } of resolutions.values()) {
    if (!memberScoped) continue;
    const remaining = await db.artifactPlacement.count({
      where: { artifactId, containerArtifactId: { not: leavingContainerArtifactId } },
    });
    if (remaining === 0) {
      throw makeError({
        status: 422,
        message:
          "Org-user content must stay in a container, or it would show in the org's normal browse: place it in another of the org's containers first (that shares it), or delete it",
      });
    }
  }
};
