/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:auth
 */
import { validateHeldGrant } from '#/lib/permissions/validateHeldGrant';
import { makeController } from '#/lib/utils/makeController';
import { meCreateTokenRoute } from '#/modules/me/routes/meCreateToken';
import { createToken } from '#/modules/me/services/createToken';

export const meCreateTokenController = makeController(meCreateTokenRoute, async (c, respond) => {
  const user = c.get('user')!;
  const body = c.req.valid('json');

  await validateHeldGrant(c, {
    role: body.role,
    entitlements: body.entitlements ?? null,
    entitlementsOnly: body.entitlementsOnly ?? false,
  });

  const token = await createToken(c, {
    name: body.name,
    ownerModel: 'User',
    userId: user.id,
    role: body.role,
    entitlements: body.entitlements,
    entitlementsOnly: body.entitlementsOnly,
    expiresAt: body.expiresAt,
    integrationReach: body.integrationReach,
    integrationReachIds: body.integrationReachIds,
  });

  return respond.created(token);
});
