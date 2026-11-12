/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 * @uses primitive:authz, infrastructure:prisma
 */

import { getResource } from '#/lib/context/getResource';
import { changeEntitlements } from '#/lib/permissions/changeEntitlements';
import { makeController } from '#/lib/utils/makeController';
import { integrationCreateManyEntitlementsRoute } from '#/modules/integration/routes/integrationCreateManyEntitlements';
import { validateIntegrationRole } from '#/modules/integration/validations/validateIntegrationRole';

export const integrationCreateManyEntitlementsController = makeController(
  integrationCreateManyEntitlementsRoute,
  async (c, respond) => {
    const permix = c.get('permix');
    const integration = getResource<'integration'>(c);
    await validateIntegrationRole(permix, integration);
    const entitlements = await changeEntitlements(
      permix,
      { model: 'Integration', id: integration.id },
      {
        add: c.req.valid('json'),
      },
    );
    return respond.created(entitlements);
  },
);
