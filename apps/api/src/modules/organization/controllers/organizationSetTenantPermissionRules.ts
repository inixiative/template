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
import { organizationSetTenantPermissionRulesRoute } from '#/modules/organization/routes/organizationSetTenantPermissionRules';

export const organizationSetTenantPermissionRulesController = makeController(
  organizationSetTenantPermissionRulesRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { id } = contextResource<'organization'>(c);
    const { tenantPermissionRules } = c.req.valid('json');

    const organization = await db.organization.update({
      where: { id },
      data: {
        tenantPermissionRules:
          (tenantPermissionRules as Prisma.InputJsonValue | null) ?? Prisma.DbNull,
      },
    });

    await emitAppEvent('organization.updated', { organization });

    return respond.ok(organization);
  },
);
