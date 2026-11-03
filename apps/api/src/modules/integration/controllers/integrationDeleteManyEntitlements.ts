/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 * @uses primitive:authz, infrastructure:prisma
 */

import { getResource } from '#/lib/context/getResource';
import { changeEntitlements } from '#/lib/permissions/changeEntitlements';
import { makeController } from '#/lib/utils/makeController';
import { integrationDeleteManyEntitlementsRoute } from '#/modules/integration/routes/integrationDeleteManyEntitlements';
import { validateIntegrationRole } from '#/modules/integration/validations/validateIntegrationRole';

export const integrationDeleteManyEntitlementsController = makeController(
  integrationDeleteManyEntitlementsRoute,
  async (c, respond) => {
    const permix = c.get('permix');
    const integration = getResource<'integration'>(c);
    await validateIntegrationRole(permix, integration);
    await changeEntitlements(
      permix,
      { model: 'Integration', id: integration.id },
      {
        remove: c.req.valid('json'),
      },
    );
    return respond.noContent();
  },
);
