/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { artifactDeleteRoute } from '#/modules/artifact/routes/artifactDelete';
import { withLockedArtifacts } from '#/modules/artifact/services/artifactOwner';
import { canActOnArtifact } from '#/modules/artifact/services/checkArtifactPermission';

export const artifactDeleteController = makeController(artifactDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const permix = c.get('permix');
  const artifact = contextResource<'artifact'>(c);
  await withLockedArtifacts([artifact], async (locked) => {
    const target = locked.get(artifact.id)!;
    if (!(await canActOnArtifact(permix, target, 'delete'))) {
      throw makeError({ status: 403, message: 'Forbidden' });
    }
    await db.artifact.update({ where: { id: target.id }, data: { deletedAt: new Date() } });
  });
  return respond.noContent();
});
