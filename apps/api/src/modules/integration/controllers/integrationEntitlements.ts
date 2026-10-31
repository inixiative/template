/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 * @uses primitive:authz, infrastructure:prisma
 */
import { hydrate, type Prisma } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { changeEntitlements } from '#/lib/permissions/changeEntitlements';
import { makeController } from '#/lib/utils/makeController';
import { integrationEntitlementsRoute } from '#/modules/integration/routes/integrationEntitlements';
import { validateIntegrationRole } from '#/modules/integration/validations/validateIntegrationGrant';

export const integrationEntitlementsController = makeController(
  integrationEntitlementsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const permix = c.get('permix');
    const integration = getResource<'integration'>(c);
    await validateIntegrationRole(permix, integration);

    const entitlements = await changeEntitlements(
      permix,
      integration.entitlements,
      c.req.valid('json'),
    );
    const updated = await db.integration.update({
      where: { id: integration.id },
      data: { entitlements: entitlements as Prisma.InputJsonValue },
    });
    return respond.ok(updated);
  },
);
