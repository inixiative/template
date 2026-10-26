/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, infrastructure:prisma, feature:integrations
 */
import { Prisma } from '@template/db';
import { me } from '#/lib/context/me';
import { makeController } from '#/lib/utils/makeController';
import { validateIntegrationGrant } from '#/modules/integration/validations/validateIntegrationGrant';
import { meCreateIntegrationRoute } from '#/modules/me/routes/meCreateIntegration';

export const meCreateIntegrationController = makeController(
  meCreateIntegrationRoute,
  async (c, respond) => {
    const user = me(c)!;
    const db = c.get('db');
    const body = c.req.valid('json');

    const row = {
      ...body,
      ownerModel: 'User',
      userId: user.id,
    };
    await validateIntegrationGrant(c.get('permix'), row);

    const integration = await db.integration.create({
      data: {
        ...row,
        entitlements: row.entitlements ?? Prisma.DbNull,
      } as Prisma.IntegrationUncheckedCreateInput,
    });

    return respond.created(integration);
  },
);
