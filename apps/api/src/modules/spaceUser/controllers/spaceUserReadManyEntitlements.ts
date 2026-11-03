/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, infrastructure:prisma
 */
import { toEntitlementRowEntry } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { spaceUserReadManyEntitlementsRoute } from '#/modules/spaceUser/routes/spaceUserReadManyEntitlements';

export const spaceUserReadManyEntitlementsController = makeController(
  spaceUserReadManyEntitlementsRoute,
  async (c, respond) => {
    const spaceUser = getResource<'spaceUser'>(c);
    return respond.ok(spaceUser.targetEntitlements.map(toEntitlementRowEntry));
  },
);
