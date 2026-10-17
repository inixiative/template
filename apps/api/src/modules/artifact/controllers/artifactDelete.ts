/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { artifactDeleteRoute } from '#/modules/artifact/routes/artifactDelete';

export const artifactDeleteController = makeController(artifactDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const artifact = getResource<'artifact'>(c);
  if (artifact.system)
    throw makeError({ status: 422, message: 'System artifacts cannot be deleted' });
  await db.artifact.update({ where: { id: artifact.id }, data: { deletedAt: new Date() } });
  return respond.noContent();
});
