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
import { organizationUserCreateManyEntitlementsRoute } from '#/modules/organizationUser/routes/organizationUserCreateManyEntitlements';

export const organizationUserCreateManyEntitlementsController = makeController(
  organizationUserCreateManyEntitlementsRoute,
  async (c, respond) => {
    const permix = c.get('permix');
    const organizationUser = contextResource<'organizationUser'>(c);
    const changes = { add: c.req.valid('json') };
    await validateEntitlementWriter(permix, 'OrganizationUser', organizationUser, changes);
    const entitlements = await changeEntitlements(
      permix,
      { model: 'OrganizationUser', id: organizationUser.id },
      changes,
    );
    return respond.created(entitlements);
  },
);
