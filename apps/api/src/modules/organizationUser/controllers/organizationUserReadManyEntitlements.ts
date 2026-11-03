/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, infrastructure:prisma
 */
import { toEntitlementRowEntry } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationUserReadManyEntitlementsRoute } from '#/modules/organizationUser/routes/organizationUserReadManyEntitlements';

export const organizationUserReadManyEntitlementsController = makeController(
  organizationUserReadManyEntitlementsRoute,
  async (c, respond) => {
    const organizationUser = getResource<'organizationUser'>(c);
    return respond.ok(organizationUser.targetEntitlements.map(toEntitlementRowEntry));
  },
);
