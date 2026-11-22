/**
 * @atlas
 * @kind controller
 * @partOf feature:project
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { projectIntegrationReadRoute } from '#/modules/projectIntegration/routes/projectIntegrationRead';

export const projectIntegrationReadController = makeController(
  projectIntegrationReadRoute,
  async (c, respond) => {
    const projectIntegration = contextResource<'projectIntegration'>(c);
    return respond.ok(projectIntegration);
  },
);
