/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, primitive:routeTemplates, infrastructure:prisma
 */
import { toEntitlementRowEntry } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { spaceUserReadManyEntitlementsRoute } from '#/modules/spaceUser/routes/spaceUserReadManyEntitlements';

export const spaceUserReadManyEntitlementsController = makeController(
  spaceUserReadManyEntitlementsRoute,
  async (c, respond) => {
    const spaceUser = getResource<'spaceUser'>(c);
    const { data, pagination } = await paginate(c, c.get('db').entitlement, {
      where: { targetModel: 'SpaceUser', targetId: spaceUser.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return respond.ok(data.map(toEntitlementRowEntry), { pagination });
  },
);
