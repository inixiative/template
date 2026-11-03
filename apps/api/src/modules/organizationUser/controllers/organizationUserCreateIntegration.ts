/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses feature:integrations
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { createIntegration } from '#/modules/integration/services/createIntegration';
import { organizationUserCreateIntegrationRoute } from '#/modules/organizationUser/routes/organizationUserCreateIntegration';

export const organizationUserCreateIntegrationController = makeController(
  organizationUserCreateIntegrationRoute,
  async (c, respond) => {
    const member = getResource<'organizationUser'>(c);
    const row = {
      ...c.req.valid('json'),
      ownerModel: 'OrganizationUser' as const,
      organizationId: member.organizationId,
      userId: member.userId,
    };
    const integration = await createIntegration(c.get('permix'), row);

    return respond.created(integration);
  },
);
