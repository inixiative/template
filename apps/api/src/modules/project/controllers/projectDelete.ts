/**
 * @atlas
 * @kind controller
 * @partOf feature:project
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { projectDeleteRoute } from '#/modules/project/routes/projectDelete';

export const projectDeleteController = makeController(projectDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const project = contextResource<'project'>(c);
  await db.project.update({ where: { id: project.id }, data: { deletedAt: new Date() } });
  return respond.noContent();
});
