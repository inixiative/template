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
import { checkArtifactAccess } from '#/modules/artifact/services/checkArtifactAccess';

export const deleteArtifact = async (actor: ArtifactActor, artifact: Artifact): Promise<void> => {
  if (artifact.system) {
    throw makeError({ status: 422, message: 'System artifacts cannot be deleted' });
  }
  const containerCount = await db.artifactContainer.count({ where: { artifactId: artifact.id } });
  const action = containerCount > 1 ? 'own' : 'manage';
  const verdicts = await checkArtifactAccess(actor, [artifact.id], action);
  assertArtifactAction(verdicts.get(artifact.id), action);
  await db.artifact.update({ where: { id: artifact.id }, data: { deletedAt: new Date() } });
};
