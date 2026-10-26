/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, primitive:routeTemplates, infrastructure:prisma
 */
import { db, hydrate } from '@template/db';
import { check, rebacSchema } from '@template/permissions/rebac';
import { roleAssignment } from '@template/permissions/rebac/schemaHelpers';
import { getResource } from '#/lib/context/getResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { spaceUserUpdateRoute } from '#/modules/spaceUser/routes/spaceUserUpdate';

export const spaceUserUpdateController = makeController(
  spaceUserUpdateRoute,
  async (c, respond) => {
    const spaceUser = getResource<'spaceUser'>(c);
    const body = c.req.valid('json');
    const permix = c.get('permix');

    const before = await hydrate('spaceUser', spaceUser);
    const after = await hydrate('spaceUser', { ...spaceUser, role: body.role ?? spaceUser.role });
    if (
      !check(permix, rebacSchema, 'spaceUser', before, roleAssignment) ||
      !check(permix, rebacSchema, 'spaceUser', after, roleAssignment)
    )
      throw makeError({ status: 403, message: `Cannot assign ${after.role} role` });

    const updated = await db.spaceUser.update({
      where: { id: spaceUser.id },
      data: body,
    });

    return respond.ok(updated);
  },
);
