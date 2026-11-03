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
import { organizationUserReadManyEntitlementsRoute } from '#/modules/organizationUser/routes/organizationUserReadManyEntitlements';

export const organizationUserReadManyEntitlementsController = makeController(
  organizationUserReadManyEntitlementsRoute,
  async (c, respond) => {
    const organizationUser = getResource<'organizationUser'>(c);
    const { data, pagination } = await paginate(c, c.get('db').entitlement, {
      where: { targetModel: 'OrganizationUser', targetId: organizationUser.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return respond.ok(data.map(toEntitlementRowEntry), { pagination });
  },
);
