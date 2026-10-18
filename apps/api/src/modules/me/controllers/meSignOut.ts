/**
 * @atlas
 * @kind controller
 * @partOf feature:users, feature:auth
 * @uses primitive:routeTemplates
 */
import { revokeUserJwts } from '#/lib/auth/jwtRevocation';
import { makeController } from '#/lib/utils/makeController';
import { meSignOutRoute } from '#/modules/me/routes/meSignOut';

export const meSignOutController = makeController(meSignOutRoute, async (c, respond) => {
  await revokeUserJwts(c.get('user')!.id);
  return respond.noContent();
});
