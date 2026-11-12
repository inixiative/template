/**
 * @atlas
 * @kind controller
 * @partOf feature:project
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { projectUpdateRoute } from '#/modules/project/routes/projectUpdate';

export const projectUpdateController = makeController(projectUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const project = getResource<'project'>(c);
  const updated = await db.project.update({ where: { id: project.id }, data: c.req.valid('json') });
  return respond.ok(updated);
});
