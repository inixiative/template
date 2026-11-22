/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { Prisma } from '@template/db';
import { emitAppEvent } from '#/appEvents/emit';
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { spaceSetTenantPermissionRulesRoute } from '#/modules/space/routes/spaceSetTenantPermissionRules';

export const spaceSetTenantPermissionRulesController = makeController(
  spaceSetTenantPermissionRulesRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { id } = contextResource<'space'>(c);
    const { tenantPermissionRules } = c.req.valid('json');

    const space = await db.space.update({
      where: { id },
      data: {
        tenantPermissionRules:
          (tenantPermissionRules as Prisma.InputJsonValue | null) ?? Prisma.DbNull,
      },
    });

    await emitAppEvent('space.updated', { space });

    return respond.ok(space);
  },
);
