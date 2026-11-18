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
import { organizationUserDeleteManyEntitlementsRoute } from '#/modules/organizationUser/routes/organizationUserDeleteManyEntitlements';

export const organizationUserDeleteManyEntitlementsController = makeController(
  organizationUserDeleteManyEntitlementsRoute,
  async (c, respond) => {
    const permix = c.get('permix');
    const organizationUser = contextResource<'organizationUser'>(c);
    const changes = { remove: c.req.valid('json') };
    await validateEntitlementWriter(permix, 'OrganizationUser', organizationUser, changes);
    await changeEntitlements(
      permix,
      { model: 'OrganizationUser', id: organizationUser.id },
      changes,
    );
    return respond.noContent();
  },
);
