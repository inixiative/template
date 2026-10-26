/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 * @uses primitive:authz, primitive:routeTemplates, infrastructure:prisma
 */
import { Prisma } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { integrationUpdateRoute } from '#/modules/integration/routes/integrationUpdate';
import { validateIntegrationGrant } from '#/modules/integration/validations/validateIntegrationGrant';

const permissionFields = ['role', 'full', 'entitlements'];

export const integrationUpdateController = makeController(
  integrationUpdateRoute,
  async (c, respond) => {
    const db = c.get('db');
    const integration = getResource<'integration'>(c);
    const body = c.req.valid('json');

    if (permissionFields.some((field) => field in body)) {
      await validateIntegrationGrant(c.get('permix'), integration);
      await validateIntegrationGrant(c.get('permix'), { ...integration, ...body });
    }

    const updated = await db.integration.update({
      where: { id: integration.id },
      data: {
        ...body,
        entitlements: body.entitlements === null ? Prisma.DbNull : body.entitlements,
      } as Prisma.IntegrationUncheckedUpdateInput,
    });

    return respond.ok(updated);
  },
);
