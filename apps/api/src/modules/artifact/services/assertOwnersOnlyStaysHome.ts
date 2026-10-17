/**
 * @atlas
 * @kind validator
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import { isOwnerRootKind } from '@template/shared/artifact';
import { uniq } from 'lodash-es';
import { makeError } from '#/lib/errors';
import { sameArtifactOwner } from '#/modules/artifact/lib/artifactOwner';
import { listArtifactDescendants } from '#/modules/artifact/services/listArtifactDescendants';
import { resolveArtifactAccess } from '#/modules/artifact/services/resolveArtifactAccess';

export const assertOwnersOnlyStaysHome = async (artifactIds: string[]): Promise<void> => {
  const descendants = await Promise.all(artifactIds.map((id) => listArtifactDescendants(id)));
  const affected = uniq([...artifactIds, ...descendants.flatMap((tree) => tree.artifactIds)]);
  if (affected.length === 0) return;
  const resolutions = await resolveArtifactAccess(affected);
  const ownersOnly = [...resolutions.values()]
    .filter((resolution) => resolution.ownersOnly)
    .map((resolution) => resolution.artifactId);
  if (ownersOnly.length === 0) return;

  const placements = await db.artifactContainer.findMany({
    where: { artifactId: { in: ownersOnly } },
    include: { artifact: true, containerArtifact: true },
  });
  const abroad = placements.filter(
    ({ artifact, containerArtifact }) =>
      !isOwnerRootKind(containerArtifact.kind) && !sameArtifactOwner(artifact, containerArtifact),
  );
  if (abroad.length) {
    throw makeError({
      status: 422,
      message:
        "This would make org-user content of something placed in another owner's container; remove it from there first",
    });
  }
};
