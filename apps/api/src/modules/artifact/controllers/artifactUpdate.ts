/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import type { Artifact } from '@template/db/generated/client/client';
import { contextResource } from '#/lib/context/contextResource';
import { makeError } from '#/lib/errors';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';
import { makeController } from '#/lib/utils/makeController';
import { artifactOwner } from '#/modules/artifact/lib/artifactOwner';
import { canActOnArtifact } from '#/modules/artifact/lib/checkArtifactPermission';
import { artifactUpdateRoute } from '#/modules/artifact/routes/artifactUpdate';

export const artifactUpdateController = makeController(artifactUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const permix = c.get('permix');
  const artifact = contextResource<'artifact'>(c);
  const data = c.req.valid('json');
  const updated = await withOwnerLock(artifactOwner(artifact), 'containers', () =>
    db.txn(async () => {
      const [locked] = await db.findForUpdate<Artifact>('Artifact', { id: artifact.id });
      if (!locked || locked.deletedAt) {
        throw makeError({ status: 404, message: 'Artifact not found' });
      }
      if (data.access !== undefined && data.access !== locked.access) {
        if (!(await canActOnArtifact(permix, locked, 'manage'))) {
          throw makeError({ status: 403, message: 'Forbidden' });
        }
      }
      return db.artifact.update({
        where: { id: locked.id },
        data,
      });
    }),
  );
  return respond.ok(updated);
});
