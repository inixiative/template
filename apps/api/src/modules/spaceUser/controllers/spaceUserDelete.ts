import { db, type HydratedRecord, hydrate } from '@template/db';
import { check, rebacSchema } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { spaceUserDeleteRoute } from '#/modules/spaceUser/routes/spaceUserDelete';

export const spaceUserDeleteController = makeController(spaceUserDeleteRoute, async (c, respond) => {
  const spaceUser = getResource<'spaceUser'>(c);
  const permix = c.get('permix');

  const hydrated = await hydrate(db, 'spaceUser', spaceUser);
  const space = hydrated.space as HydratedRecord;

  const canLeave = check(permix, rebacSchema, 'spaceUser', spaceUser, 'leave');
  const canAssign = check(permix, rebacSchema, 'space', { ...space, role: spaceUser.role }, 'assign');
  if (!canLeave && !canAssign) throw makeError({ status: 403, message: 'Cannot remove this user', requestId: c.get('requestId') });

  await db.spaceUser.delete({ where: { id: spaceUser.id } });

  return respond.noContent();
});
