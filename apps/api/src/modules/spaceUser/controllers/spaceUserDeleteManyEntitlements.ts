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
import { spaceUserDeleteManyEntitlementsRoute } from '#/modules/spaceUser/routes/spaceUserDeleteManyEntitlements';

export const spaceUserDeleteManyEntitlementsController = makeController(
  spaceUserDeleteManyEntitlementsRoute,
  async (c, respond) => {
    const permix = c.get('permix');
    const spaceUser = contextResource<'spaceUser'>(c);
    const changes = { remove: c.req.valid('json') };
    await validateEntitlementWriter(permix, 'SpaceUser', spaceUser, changes);
    await changeEntitlements(permix, { model: 'SpaceUser', id: spaceUser.id }, changes);
    return respond.noContent();
  },
);
