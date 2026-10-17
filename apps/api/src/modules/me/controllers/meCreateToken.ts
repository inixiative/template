/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:auth
 */
import { userHeldOn } from '#/lib/permissions/userHeldOn';
import { validateHeldActions } from '#/lib/permissions/validateHeldActions';
import { makeController } from '#/lib/utils/makeController';
import { meCreateTokenRoute } from '#/modules/me/routes/meCreateToken';
import { createToken } from '#/modules/me/services/createToken';

export const meCreateTokenController = makeController(meCreateTokenRoute, async (c, respond) => {
  const user = c.get('user')!;
  const body = c.req.valid('json');

  if (body.entitlements)
    validateHeldActions(c.get('permix'), await userHeldOn(c), body.entitlements);

  const token = await createToken(c, {
    name: body.name,
    ownerModel: 'User',
    userId: user.id,
    role: body.role,
    entitlements: body.entitlements,
    entitlementsOnly: body.entitlementsOnly,
    expiresAt: body.expiresAt,
  });

  return respond.created(token);
});
