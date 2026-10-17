/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { Artifact, ArtifactContainer } from '@template/db/generated/client/client';
import { isOwnerRootKind } from '@template/shared/artifact';
import { sameArtifactOwner } from '#/modules/artifact/lib/artifactOwner';

export const listOwnContainerPlacements = async (
  artifact: Artifact,
): Promise<ArtifactContainer[]> => {
  const placements = await db.artifactContainer.findMany({
    where: { artifactId: artifact.id },
    include: { containerArtifact: true },
  });
  return placements
    .filter(
      ({ containerArtifact }) =>
        !isOwnerRootKind(containerArtifact.kind) && sameArtifactOwner(containerArtifact, artifact),
    )
    .map(({ containerArtifact: _containerArtifact, ...placement }) => placement);
};
