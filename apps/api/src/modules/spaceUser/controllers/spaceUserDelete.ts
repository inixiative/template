import { db, hydrate, type HydratedRecord } from '@template/db';
import { check, rebacSchema } from '@template/permissions/rebac';
import { HTTPException } from 'hono/http-exception';
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
  if (!canLeave && !canAssign) throw new HTTPException(403, { message: 'Cannot remove this user' });

  await db.spaceUser.delete({ where: { id: spaceUser.id } });

  return respond.noContent();
});
