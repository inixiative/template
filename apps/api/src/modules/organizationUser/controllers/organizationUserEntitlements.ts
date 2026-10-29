/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, infrastructure:prisma
 */
import { hydrate, type Prisma } from '@template/db';
import { check, rebacSchema } from '@template/permissions/rebac';
import { memberRoleWrite } from '@template/permissions/rebac/schemaHelpers';
import { getResource } from '#/lib/context/getResource';
import { makeError } from '#/lib/errors';
import { changeEntitlements } from '#/lib/permissions/changeEntitlements';
import { makeController } from '#/lib/utils/makeController';
import { organizationUserEntitlementsRoute } from '#/modules/organizationUser/routes/organizationUserEntitlements';

export const organizationUserEntitlementsController = makeController(
  organizationUserEntitlementsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const permix = c.get('permix');
    const orgUser = getResource<'organizationUser'>(c);
    const row = await hydrate('organizationUser', orgUser);
    if (!check(permix, rebacSchema, 'organizationUser', row, memberRoleWrite('organization')))
      throw makeError({ status: 403, message: 'Access denied' });

    const entitlements = await changeEntitlements(
      permix,
      orgUser.entitlements,
      c.req.valid('json'),
    );
    const updated = await db.organizationUser.update({
      where: { id: orgUser.id },
      data: { entitlements: entitlements as Prisma.InputJsonValue },
    });
    return respond.ok(updated);
  },
);
