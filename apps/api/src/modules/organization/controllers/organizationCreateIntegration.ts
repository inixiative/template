/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { Prisma } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { validateIntegrationGrant } from '#/modules/integration/validations/validateIntegrationGrant';
import { organizationCreateIntegrationRoute } from '#/modules/organization/routes/organizationCreateIntegration';

export const organizationCreateIntegrationController = makeController(
  organizationCreateIntegrationRoute,
  async (c, respond) => {
    const db = c.get('db');
    const organization = getResource<'organization'>(c);
    const body = c.req.valid('json');

    const row = {
      ...body,
      ownerModel: 'Organization',
      organizationId: organization.id,
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
