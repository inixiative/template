/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { createIntegration } from '#/modules/integration/services/createIntegration';
import { organizationCreateIntegrationRoute } from '#/modules/organization/routes/organizationCreateIntegration';

export const organizationCreateIntegrationController = makeController(
  organizationCreateIntegrationRoute,
  async (c, respond) => {
    const organization = getResource<'organization'>(c);
    const body = c.req.valid('json');

    const row = {
      ...body,
      ownerModel: 'Organization' as const,
      organizationId: organization.id,
    };
    const integration = await createIntegration(c.get('permix'), row);

    return respond.created(integration);
  },
);
