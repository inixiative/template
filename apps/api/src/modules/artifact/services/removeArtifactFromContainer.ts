/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { ArtifactContainer } from '@template/db/generated/client/client';
import type { ArtifactActor } from '#/modules/artifact/lib/artifactActor';
import { assertEdgeAuthority } from '#/modules/artifact/services/addArtifactToContainer';

export const removeArtifactFromContainer = async (
  actor: ArtifactActor,
  edge: ArtifactContainer,
): Promise<void> => {
  await assertEdgeAuthority(actor, edge.artifactId, edge.containerArtifactId);
  await db.artifactContainer.delete({ where: { id: edge.id } });
};
