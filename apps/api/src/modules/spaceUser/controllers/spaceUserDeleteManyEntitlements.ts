/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, infrastructure:prisma
 */

import { getResource } from '#/lib/context/getResource';
import { changeEntitlements } from '#/lib/permissions/changeEntitlements';
import { validateMemberGrant } from '#/lib/permissions/validateMemberGrant';
import { makeController } from '#/lib/utils/makeController';
import { spaceUserDeleteManyEntitlementsRoute } from '#/modules/spaceUser/routes/spaceUserDeleteManyEntitlements';

export const spaceUserDeleteManyEntitlementsController = makeController(
  spaceUserDeleteManyEntitlementsRoute,
  async (c, respond) => {
    const permix = c.get('permix');
    const spaceUser = getResource<'spaceUser'>(c);
    await validateMemberGrant(permix, 'spaceUser', spaceUser);
    await changeEntitlements(
      permix,
      { model: 'SpaceUser', id: spaceUser.id },
      {
        remove: c.req.valid('json'),
      },
    );
    return respond.noContent();
  },
);
