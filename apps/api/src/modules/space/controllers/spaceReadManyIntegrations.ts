/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, infrastructure:prisma, feature:integrations
 */
import { paginate } from '#/lib/prisma/paginate';
import { submodelOwnerWhere } from '#/lib/prisma/submodelOwnerWhere';
import { makeController } from '#/lib/utils/makeController';
import { spaceReadManyIntegrationsRoute } from '#/modules/space/routes/spaceReadManyIntegrations';

export const spaceReadManyIntegrationsController = makeController(
  spaceReadManyIntegrationsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.integration, {
      where: submodelOwnerWhere(c),
    });
    return respond.ok(data, { pagination });
  },
);
