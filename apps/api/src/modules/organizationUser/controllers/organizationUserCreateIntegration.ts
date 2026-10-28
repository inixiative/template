/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses feature:integrations
 */
import { Prisma } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { validateIntegrationGrant } from '#/modules/integration/validations/validateIntegrationGrant';
import { organizationUserCreateIntegrationRoute } from '#/modules/organizationUser/routes/organizationUserCreateIntegration';

export const organizationUserCreateIntegrationController = makeController(
  organizationUserCreateIntegrationRoute,
  async (c, respond) => {
    const db = c.get('db');
    const member = getResource<'organizationUser'>(c);
    const row = {
      ...c.req.valid('json'),
      ownerModel: 'OrganizationUser' as const,
      organizationId: member.organizationId,
      userId: member.userId,
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
