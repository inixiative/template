/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { artifactUpdateRoute } from '#/modules/artifact/routes/artifactUpdate';
import { withLockedArtifacts } from '#/modules/artifact/services/artifactOwner';
import { canActOnArtifact } from '#/modules/artifact/services/checkArtifactPermission';

export const artifactUpdateController = makeController(artifactUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const permix = c.get('permix');
  const artifact = contextResource<'artifact'>(c);
  const data = c.req.valid('json');
  const updated = await withLockedArtifacts([artifact], async (locked) => {
    const target = locked.get(artifact.id)!;
    if (data.access !== undefined && data.access !== target.access) {
      if (!(await canActOnArtifact(permix, target, 'manage'))) {
        throw makeError({ status: 403, message: 'Forbidden' });
      }
    }
    return db.artifact.update({ where: { id: target.id }, data });
  });
  return respond.ok(updated);
});
