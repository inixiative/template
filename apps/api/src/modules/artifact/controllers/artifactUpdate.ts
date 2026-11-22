/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactUpdateRoute } from '#/modules/artifact/routes/artifactUpdate';

export const artifactUpdateController = makeController(artifactUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const artifact = contextResource<'artifact'>(c);
  const updated = await db.artifact.update({
    where: { id: artifact.id },
    data: c.req.valid('json'),
  });
  return respond.ok(updated);
});
