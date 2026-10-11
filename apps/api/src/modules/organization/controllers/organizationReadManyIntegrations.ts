/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, infrastructure:prisma, feature:integrations
 */
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { organizationReadManyIntegrationsRoute } from '#/modules/organization/routes/organizationReadManyIntegrations';

export const organizationReadManyIntegrationsController = makeController(
  organizationReadManyIntegrationsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const organization = getResource<'organization'>(c);

    const { data, pagination } = await paginate(c, db.integration, {
      where: { organizationId: organization.id, ownerModel: 'Organization' },
    });

    return respond.ok(data, { pagination });
  },
);
