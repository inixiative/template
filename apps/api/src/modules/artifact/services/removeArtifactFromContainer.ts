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
import { assertKeepsOwnersOnlyReach } from '#/modules/artifact/services/assertKeepsOwnersOnlyReach';

export const removeArtifactFromContainer = async (
  actor: ArtifactActor,
  edge: ArtifactContainer,
): Promise<void> => {
  await assertEdgeAuthority(actor, edge.artifactId, edge.containerArtifactId);
  await assertKeepsOwnersOnlyReach([edge.artifactId]);
  await db.artifactContainer.update({ where: { id: edge.id }, data: { deletedAt: new Date() } });
};
