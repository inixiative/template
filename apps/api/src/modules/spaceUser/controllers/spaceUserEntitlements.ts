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
import { spaceUserEntitlementsRoute } from '#/modules/spaceUser/routes/spaceUserEntitlements';

export const spaceUserEntitlementsController = makeController(
  spaceUserEntitlementsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const permix = c.get('permix');
    const spaceUser = getResource<'spaceUser'>(c);
    const row = await hydrate('spaceUser', spaceUser);
    if (!check(permix, rebacSchema, 'spaceUser', row, memberRoleWrite('space')))
      throw makeError({ status: 403, message: 'Access denied' });

    const entitlements = await changeEntitlements(
      permix,
      spaceUser.entitlements,
      c.req.valid('json'),
    );
    const updated = await db.spaceUser.update({
      where: { id: spaceUser.id },
      data: { entitlements: entitlements as Prisma.InputJsonValue },
    });
    return respond.ok(updated);
  },
);
