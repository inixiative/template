/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 * @uses primitive:authz, infrastructure:prisma
 */
import { toEntitlementRowEntry } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { integrationReadManyEntitlementsRoute } from '#/modules/integration/routes/integrationReadManyEntitlements';

export const integrationReadManyEntitlementsController = makeController(
  integrationReadManyEntitlementsRoute,
  async (c, respond) => {
    const integration = getResource<'integration'>(c);
    return respond.ok(integration.targetEntitlements.map(toEntitlementRowEntry));
  },
);
