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
import { spaceUserCreateManyEntitlementsRoute } from '#/modules/spaceUser/routes/spaceUserCreateManyEntitlements';

export const spaceUserCreateManyEntitlementsController = makeController(
  spaceUserCreateManyEntitlementsRoute,
  async (c, respond) => {
    const permix = c.get('permix');
    const spaceUser = getResource<'spaceUser'>(c);
    await validateMemberGrant(permix, 'spaceUser', spaceUser);
    const entitlements = await changeEntitlements(
      permix,
      { model: 'SpaceUser', id: spaceUser.id },
      {
        add: c.req.valid('json'),
      },
    );
    return respond.created(entitlements);
  },
);
