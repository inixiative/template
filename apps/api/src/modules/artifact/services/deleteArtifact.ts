/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex
 */
import { db } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import type { Permix } from '@template/permissions/client';
import { makeError } from '#/lib/errors';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';
import { artifactOwner } from '#/modules/artifact/lib/artifactOwner';
import { assertArtifactPermission } from '#/modules/artifact/lib/checkArtifactPermission';

export const deleteArtifact = async (permix: Permix, artifact: Artifact): Promise<void> => {
  await withOwnerLock(artifactOwner(artifact), 'containers', () =>
    db.txn(async () => {
      const [locked] = await db.findForUpdate<Artifact>('Artifact', { id: artifact.id });
      if (!locked || locked.deletedAt) {
        throw makeError({ status: 404, message: 'Artifact not found' });
      }
      await assertArtifactPermission(permix, locked.id, 'delete');
      await db.artifact.update({ where: { id: locked.id }, data: { deletedAt: new Date() } });
    }),
  );
};
