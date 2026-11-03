/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, infrastructure:prisma
 */

import { toEntitlementRowEntry } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { changeEntitlements } from '#/lib/permissions/changeEntitlements';
import { validateMemberGrant } from '#/lib/permissions/validateMemberGrant';
import { makeController } from '#/lib/utils/makeController';
import { organizationUserCreateManyEntitlementsRoute } from '#/modules/organizationUser/routes/organizationUserCreateManyEntitlements';

export const organizationUserCreateManyEntitlementsController = makeController(
  organizationUserCreateManyEntitlementsRoute,
  async (c, respond) => {
    const permix = c.get('permix');
    const organizationUser = getResource<'organizationUser'>(c);
    await validateMemberGrant(permix, 'organizationUser', organizationUser);
    const entitlements = await changeEntitlements(
      permix,
      { model: 'OrganizationUser', id: organizationUser.id },
      {
        add: c.req.valid('json'),
      },
    );
    return respond.created(entitlements.map(toEntitlementRowEntry));
  },
);
