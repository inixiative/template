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
import { integrationDeleteManyEntitlementsRoute } from '#/modules/integration/routes/integrationDeleteManyEntitlements';

export const integrationDeleteManyEntitlementsController = makeController(
  integrationDeleteManyEntitlementsRoute,
  async (c, respond) => {
    const permix = c.get('permix');
    const integration = contextResource<'integration'>(c);
    const changes = { remove: c.req.valid('json') };
    await validateEntitlementWriter(permix, 'Integration', integration, changes);
    await changeEntitlements(permix, { model: 'Integration', id: integration.id }, changes);
    return respond.noContent();
  },
);
