/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { ownerColumns, Prisma } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { validateIntegrationGrant } from '#/modules/integration/validations/validateIntegrationGrant';
import { spaceCreateIntegrationRoute } from '#/modules/space/routes/spaceCreateIntegration';

export const spaceCreateIntegrationController = makeController(
  spaceCreateIntegrationRoute,
  async (c, respond) => {
    const db = c.get('db');
    const space = getResource<'space'>(c);
    const body = c.req.valid('json');

    const row = {
      ...body,
      ...ownerColumns('integration', 'space', space),
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
