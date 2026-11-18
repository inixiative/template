/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 * @uses primitive:authz, infrastructure:prisma
 */

import { contextResource } from '#/lib/context/contextResource';
import { changeEntitlements } from '#/lib/permissions/changeEntitlements';
import { validateEntitlementWriter } from '#/lib/permissions/validateEntitlementWriter';
import { makeController } from '#/lib/utils/makeController';
import { integrationCreateManyEntitlementsRoute } from '#/modules/integration/routes/integrationCreateManyEntitlements';

export const integrationCreateManyEntitlementsController = makeController(
  integrationCreateManyEntitlementsRoute,
  async (c, respond) => {
    const permix = c.get('permix');
    const integration = contextResource<'integration'>(c);
    const changes = { add: c.req.valid('json') };
    await validateEntitlementWriter(permix, 'Integration', integration, changes);
    const entitlements = await changeEntitlements(
      permix,
      { model: 'Integration', id: integration.id },
      changes,
    );
    return respond.created(entitlements);
  },
);
