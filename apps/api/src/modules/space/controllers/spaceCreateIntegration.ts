/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { createIntegration } from '#/modules/integration/services/createIntegration';
import { spaceCreateIntegrationRoute } from '#/modules/space/routes/spaceCreateIntegration';

export const spaceCreateIntegrationController = makeController(
  spaceCreateIntegrationRoute,
  async (c, respond) => {
    const space = getResource<'space'>(c);
    const body = c.req.valid('json');

    const row = {
      ...body,
      ownerModel: 'Space' as const,
      organizationId: space.organizationId,
      spaceId: space.id,
    };
    const integration = await createIntegration(c.get('permix'), row);

    return respond.created(integration);
  },
);
