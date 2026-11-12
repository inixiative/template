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
import { organizationUserDeleteManyEntitlementsRoute } from '#/modules/organizationUser/routes/organizationUserDeleteManyEntitlements';

export const organizationUserDeleteManyEntitlementsController = makeController(
  organizationUserDeleteManyEntitlementsRoute,
  async (c, respond) => {
    const permix = c.get('permix');
    const organizationUser = getResource<'organizationUser'>(c);
    await validateMemberGrant(permix, 'organizationUser', organizationUser);
    await changeEntitlements(
      permix,
      { model: 'OrganizationUser', id: organizationUser.id },
      {
        remove: c.req.valid('json'),
      },
    );
    return respond.noContent();
  },
);
