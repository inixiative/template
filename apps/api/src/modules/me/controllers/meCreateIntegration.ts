/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, infrastructure:prisma, feature:integrations
 */
import { me } from '#/lib/context/me';
import { makeController } from '#/lib/utils/makeController';
import { createIntegration } from '#/modules/integration/services/createIntegration';
import { meCreateIntegrationRoute } from '#/modules/me/routes/meCreateIntegration';

export const meCreateIntegrationController = makeController(
  meCreateIntegrationRoute,
  async (c, respond) => {
    const user = me(c)!;
    const body = c.req.valid('json');

    const row = {
      ...body,
      ownerModel: 'User' as const,
      userId: user.id,
    };
    const integration = await createIntegration(c.get('permix'), row);

    return respond.created(integration);
  },
);
