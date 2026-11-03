import { includeTargetEntitlements, type Prisma, withEntitlementEntries } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { integrationUpdateRoute } from '#/modules/integration/routes/integrationUpdate';
import { validateIntegrationRole } from '#/modules/integration/validations/validateIntegrationRole';

const permissionFields = ['role', 'full'];

export const integrationUpdateController = makeController(
  integrationUpdateRoute,
  async (c, respond) => {
    const db = c.get('db');
    const integration = getResource<'integration'>(c);
    const body = c.req.valid('json');

    if (permissionFields.some((field) => field in body)) {
      await validateIntegrationRole(c.get('permix'), integration);
      await validateIntegrationRole(c.get('permix'), { ...integration, ...body });
    }
    await db.integration.update({
      where: { id: integration.id },
      data: body as Prisma.IntegrationUncheckedUpdateInput,
    });
    const updated = await db.integration.findUniqueOrThrow({
      where: { id: integration.id },
      include: includeTargetEntitlements,
    });

    return respond.ok(withEntitlementEntries(updated));
  },
);
