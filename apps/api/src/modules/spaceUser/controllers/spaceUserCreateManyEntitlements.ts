/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, infrastructure:prisma
 */

import { contextResource } from '#/lib/context/contextResource';
import { changeEntitlements } from '#/lib/permissions/changeEntitlements';
import { validateEntitlementWriter } from '#/lib/permissions/validateEntitlementWriter';
import { makeController } from '#/lib/utils/makeController';
import { spaceUserCreateManyEntitlementsRoute } from '#/modules/spaceUser/routes/spaceUserCreateManyEntitlements';

export const spaceUserCreateManyEntitlementsController = makeController(
  spaceUserCreateManyEntitlementsRoute,
  async (c, respond) => {
    const permix = c.get('permix');
    const spaceUser = contextResource<'spaceUser'>(c);
    const changes = { add: c.req.valid('json') };
    await validateEntitlementWriter(permix, 'SpaceUser', spaceUser, changes);
    const entitlements = await changeEntitlements(
      permix,
      { model: 'SpaceUser', id: spaceUser.id },
      changes,
    );
    return respond.created(entitlements);
  },
);
