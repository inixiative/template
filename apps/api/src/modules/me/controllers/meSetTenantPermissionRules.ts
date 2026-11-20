/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { Prisma } from '@template/db';
import { emitAppEvent } from '#/appEvents/emit';
import { actingUser } from '#/lib/context/actingUser';
import { makeController } from '#/lib/utils/makeController';
import { meSetTenantPermissionRulesRoute } from '#/modules/me/routes/meSetTenantPermissionRules';

export const meSetTenantPermissionRulesController = makeController(
  meSetTenantPermissionRulesRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { id } = actingUser(c)!;
    const { tenantPermissionRules } = c.req.valid('json');

    const user = await db.user.update({
      where: { id },
      data: {
        tenantPermissionRules:
          (tenantPermissionRules as Prisma.InputJsonValue | null) ?? Prisma.DbNull,
      },
    });

    await emitAppEvent('user.updated', { user });

    return respond.ok(user);
  },
);
