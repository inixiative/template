import { makeController } from '#/lib/utils/makeController';
import { meCreateTokenRoute } from '#/modules/me/routes/meCreateToken';
import { createToken } from '#/modules/me/services/createToken';

export const meCreateTokenController = makeController(meCreateTokenRoute, async (c, respond) => {
  const user = c.get('user')!;
  const db = c.get('db');
  const body = c.req.valid('json');

  const token = await createToken(db, {
    name: body.name,
    ownerModel: 'User',
    userId: user.id,
    role: body.role,
    expiresAt: body.expiresAt,
  });

  return respond.created(token);
});
