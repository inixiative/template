/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, infrastructure:prisma, feature:integrations
 */
import type { Prisma } from '@template/db';
import { makeController } from '#/lib/utils/makeController';
import { bindIntegrationEntitlements } from '#/modules/integration/services/bindIntegrationEntitlements';
import { validateReachableIntegration } from '#/modules/integration/validations/validateReachableIntegration';
import { meCreateIntegrationRoute } from '#/modules/me/routes/meCreateIntegration';

export const meCreateIntegrationController = makeController(
  meCreateIntegrationRoute,
  async (c, respond) => {
    const user = c.get('user')!;
    const db = c.get('db');
    const body = c.req.valid('json');
    await validateReachableIntegration(c, { ownerModel: 'User', userId: user.id });

    const draft = bindIntegrationEntitlements({
      ...body,
      ownerModel: 'User',
      userId: user.id,
    } as Prisma.IntegrationUncheckedCreateInput);
    const integration = await db.integration.create({ data: draft });

    return respond.created(integration);
  },
);
