/**
 * @atlas
 * @kind controller
 * @partOf feature:project
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { projectReadRoute } from '#/modules/project/routes/projectRead';

export const projectReadController = makeController(projectReadRoute, async (c, respond) =>
  respond.ok(contextResource<'project'>(c)),
);
