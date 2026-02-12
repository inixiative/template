import { db, type HydratedRecord, hydrate } from '@template/db';
import { greaterRole } from '@template/permissions';
import { check, rebacSchema } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { spaceUserUpdateRoute } from '#/modules/spaceUser/routes/spaceUserUpdate';

export const spaceUserUpdateController = makeController(spaceUserUpdateRoute, async (c, respond) => {
  const spaceUser = getResource<'spaceUser'>(c);
  const body = c.req.valid('json');
  const permix = c.get('permix');

  const hydrated = await hydrate(db, 'spaceUser', spaceUser);
  const space = hydrated.space as HydratedRecord;
  const targetRole = greaterRole(spaceUser.role, body.role);

  if (!check(permix, rebacSchema, 'space', { ...space, role: targetRole }, 'assign')) {
    throw makeError({ status: 403, message: `Cannot assign ${targetRole} role`, requestId: c.get('requestId') });
  }

  const updated = await db.spaceUser.update({
    where: { id: spaceUser.id },
    data: body,
  });

  return respond.ok(updated);
});
