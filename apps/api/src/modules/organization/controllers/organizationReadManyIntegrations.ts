/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, infrastructure:prisma, feature:integrations
 */
import { paginate } from '#/lib/prisma/paginate';
import { submodelOwnerWhere } from '#/lib/prisma/submodelOwnerWhere';
import { makeController } from '#/lib/utils/makeController';
import { organizationReadManyIntegrationsRoute } from '#/modules/organization/routes/organizationReadManyIntegrations';

export const organizationReadManyIntegrationsController = makeController(
  organizationReadManyIntegrationsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.integration, {
      where: submodelOwnerWhere(c),
    });
    return respond.ok(data, { pagination });
  },
);
