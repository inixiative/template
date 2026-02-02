import { db, hydrate, type HydratedRecord } from '@template/db';
import { roleToStandardAction } from '@template/permissions';
import { check, rebacSchema } from '@template/permissions/rebac';
import { HTTPException } from 'hono/http-exception';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { createToken } from '#/modules/me/services/createToken';
import { spaceUserCreateTokenRoute } from '#/modules/spaceUser/routes/spaceUserCreateToken';

export const spaceUserCreateTokenController = makeController(spaceUserCreateTokenRoute, async (c, respond) => {
  const permix = c.get('permix');
  const spaceUser = getResource<'spaceUser'>(c);
  const body = c.req.valid('json');

  const hydrated = await hydrate(db, 'spaceUser', spaceUser);
  const checkLeave = check(permix, rebacSchema, 'spaceUser', spaceUser, 'leave');
  // Option A: User can create tokens at or below their own role level
  const space = hydrated.space as HydratedRecord;
  const checkSpace = check(permix, rebacSchema, 'space', space, roleToStandardAction(body.role));
  // Option B: Only admins+ can create tokens (uses 'assign' rules)
  // const checkSpace = check(permix, rebacSchema, 'space', { ...hydrated.space, role: body.role }, 'assign');
  if (!checkLeave || !checkSpace) throw new HTTPException(403, { message: `Cannot create ${body.role} token` });

  const token = await createToken(db, {
    name: body.name,
    ownerModel: 'SpaceUser',
    userId: spaceUser.userId,
    organizationId: spaceUser.organizationId,
    spaceId: spaceUser.spaceId,
    role: body.role,
    expiresAt: body.expiresAt,
  });

  return respond.created(token);
});
