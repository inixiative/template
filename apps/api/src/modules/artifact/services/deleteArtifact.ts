/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex
 */
import { db } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import { makeError } from '#/lib/errors';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';
import type { ArtifactActor } from '#/modules/artifact/lib/artifactActor';
import { artifactOwner } from '#/modules/artifact/lib/artifactOwner';
import { assertArtifactAction } from '#/modules/artifact/lib/assertArtifactAction';
import { assertKeepsMemberScope } from '#/modules/artifact/services/assertKeepsMemberScope';
import { checkArtifactAccess } from '#/modules/artifact/services/checkArtifactAccess';
import { fetchExclusiveContents } from '#/modules/artifact/services/fetchExclusiveContents';

export const deleteArtifact = async (actor: ArtifactActor, artifact: Artifact): Promise<void> => {
  if (artifact.system) {
    throw makeError({ status: 422, message: 'System artifacts cannot be deleted' });
  }
  await withOwnerLock(artifactOwner(artifact), 'containers', () =>
    db.txn(async () => {
      const [locked] = await db.findForUpdate<Artifact>('Artifact', { id: artifact.id });
      if (!locked || locked.deletedAt) {
        throw makeError({ status: 404, message: 'Artifact not found' });
      }
      if (locked.system) {
        throw makeError({ status: 422, message: 'System artifacts cannot be deleted' });
      }
      const verdicts = await checkArtifactAccess(actor, [locked.id], 'own');
      assertArtifactAction(verdicts.get(locked.id), 'own');
      const exclusive = await fetchExclusiveContents(locked.id);
      await assertKeepsMemberScope(
        exclusive.map((content) => content.id),
        locked.id,
      );
      await db.artifact.update({ where: { id: locked.id }, data: { deletedAt: new Date() } });
    }),
  );
};
