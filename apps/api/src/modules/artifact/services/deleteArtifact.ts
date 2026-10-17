/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import { makeError } from '#/lib/errors';
import type { ArtifactActor } from '#/modules/artifact/lib/artifactActor';
import { assertArtifactAction } from '#/modules/artifact/lib/assertArtifactAction';
import { assertKeepsOwnersOnlyReach } from '#/modules/artifact/services/assertKeepsOwnersOnlyReach';
import { checkArtifactAccess } from '#/modules/artifact/services/checkArtifactAccess';
import { listExclusiveContents } from '#/modules/artifact/services/listExclusiveContents';

export const deleteArtifact = async (actor: ArtifactActor, artifact: Artifact): Promise<void> => {
  if (artifact.system) {
    throw makeError({ status: 422, message: 'System artifacts cannot be deleted' });
  }
  const verdicts = await checkArtifactAccess(actor, [artifact.id], 'own');
  assertArtifactAction(verdicts.get(artifact.id), 'own');
  const exclusive = await listExclusiveContents(artifact.id);
  await assertKeepsOwnersOnlyReach(exclusive.map((content) => content.id));
  await db.artifact.update({ where: { id: artifact.id }, data: { deletedAt: new Date() } });
};
