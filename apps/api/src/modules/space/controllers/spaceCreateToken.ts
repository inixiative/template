import { db, hydrate } from '@template/db';
import { check, rebacSchema } from '@template/permissions/rebac';
import { HTTPException } from 'hono/http-exception';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { createToken } from '#/modules/me/services/createToken';
import { spaceCreateTokenRoute } from '#/modules/space/routes/spaceCreateToken';

export const spaceCreateTokenController = makeController(spaceCreateTokenRoute, async (c, respond) => {
  const permix = c.get('permix');
  const space = getResource<'space'>(c);
  const body = c.req.valid('json');

  const hydrated = await hydrate(db, 'space', space);

  if (!check(permix, rebacSchema, 'space', { ...hydrated, role: body.role }, 'assign')) {
    throw new HTTPException(403, { message: `Cannot create ${body.role} token` });
  }

  const token = await createToken(db, {
    name: body.name,
    ownerModel: 'Space',
    organizationId: space.organizationId,
    spaceId: space.id,
    role: body.role,
    expiresAt: body.expiresAt,
  });

  return respond.created(token);
});
