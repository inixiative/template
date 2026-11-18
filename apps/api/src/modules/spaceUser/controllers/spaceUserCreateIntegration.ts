/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses feature:integrations
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { createIntegration } from '#/modules/integration/services/createIntegration';
import { spaceUserCreateIntegrationRoute } from '#/modules/spaceUser/routes/spaceUserCreateIntegration';

export const spaceUserCreateIntegrationController = makeController(
  spaceUserCreateIntegrationRoute,
  async (c, respond) => {
    const member = contextResource<'spaceUser'>(c);
    const row = {
      ...c.req.valid('json'),
      ownerModel: 'SpaceUser' as const,
      organizationId: member.organizationId,
      spaceId: member.spaceId,
      userId: member.userId,
    };
    const integration = await createIntegration(c.get('permix'), row);

    return respond.created(integration);
  },
);
