/**
 * @atlas
 * @kind controller
 * @partOf feature:project
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { contextResource } from '#/lib/context/contextResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { projectReadManyProjectIntegrationsRoute } from '#/modules/project/routes/projectReadManyProjectIntegrations';

export const projectReadManyProjectIntegrationsController = makeController(
  projectReadManyProjectIntegrationsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const project = contextResource<'project'>(c);
    const { data, pagination } = await paginate(c, db.projectIntegration, {
      where: { projectId: project.id },
    });
    return respond.ok(data, { pagination });
  },
);
