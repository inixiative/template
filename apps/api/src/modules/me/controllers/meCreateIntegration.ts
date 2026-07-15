/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, infrastructure:prisma, feature:integrations
 */
import type { Prisma } from '@template/db';
import { makeController } from '#/lib/utils/makeController';
import { meCreateIntegrationRoute } from '#/modules/me/routes/meCreateIntegration';

export const meCreateIntegrationController = makeController(meCreateIntegrationRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');
  const body = c.req.valid('json');

  const integration = await db.integration.create({
    data: {
      ...body,
      ownerModel: 'User',
      userId: user.id,
    } as Prisma.IntegrationUncheckedCreateInput,
  });

  return respond.created(integration);
});
