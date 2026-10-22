/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:auth
 */
import { makeController } from '#/lib/utils/makeController';
import { meCreateTokenRoute } from '#/modules/me/routes/meCreateToken';
import { createToken } from '#/modules/me/services/createToken';

export const meCreateTokenController = makeController(meCreateTokenRoute, async (c, respond) => {
  const user = c.get('user')!;
  const body = c.req.valid('json');

  const token = await createToken(c, {
    name: body.name,
    ownerModel: 'User',
    userId: user.id,
    role: body.role,
    entitlements: body.entitlements,
    expiresAt: body.expiresAt,
  });

  return respond.created(token);
});
