/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 * @uses primitive:authz, primitive:routeTemplates, infrastructure:prisma
 */
import { toEntitlementRowEntry } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { integrationReadManyEntitlementsRoute } from '#/modules/integration/routes/integrationReadManyEntitlements';

export const integrationReadManyEntitlementsController = makeController(
  integrationReadManyEntitlementsRoute,
  async (c, respond) => {
    const integration = getResource<'integration'>(c);
    const { data, pagination } = await paginate(c, c.get('db').entitlement, {
      where: { targetModel: 'Integration', targetId: integration.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return respond.ok(data.map(toEntitlementRowEntry), { pagination });
  },
);
