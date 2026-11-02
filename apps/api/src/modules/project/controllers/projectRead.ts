/**
 * @atlas
 * @kind controller
 * @partOf feature:project
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { projectReadRoute } from '#/modules/project/routes/projectRead';

export const projectReadController = makeController(projectReadRoute, async (c, respond) =>
  respond.ok(getResource<'project'>(c)),
);
