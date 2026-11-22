/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { paginate } from '#/lib/prisma/paginate';
import { submodelOwnerWhere } from '#/lib/prisma/submodelOwnerWhere';
import { makeController } from '#/lib/utils/makeController';
import { integrationReadManyIntegrationResourcesRoute } from '#/modules/integration/routes/integrationReadManyIntegrationResources';

export const integrationReadManyIntegrationResourcesController = makeController(
  integrationReadManyIntegrationResourcesRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.integrationResource, {
      where: submodelOwnerWhere(c),
    });
    return respond.ok(data, { pagination });
  },
);
