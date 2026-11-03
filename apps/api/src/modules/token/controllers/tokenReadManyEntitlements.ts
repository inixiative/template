/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses primitive:authz, primitive:routeTemplates, infrastructure:prisma
 */
import { toEntitlementRowEntry } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { tokenReadManyEntitlementsRoute } from '#/modules/token/routes/tokenReadManyEntitlements';

export const tokenReadManyEntitlementsController = makeController(
  tokenReadManyEntitlementsRoute,
  async (c, respond) => {
    const token = getResource<'token'>(c);
    const { data, pagination } = await paginate(c, c.get('db').entitlement, {
      where: { targetModel: 'Token', targetId: token.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return respond.ok(data.map(toEntitlementRowEntry), { pagination });
  },
);
