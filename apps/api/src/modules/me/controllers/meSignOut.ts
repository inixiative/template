/**
 * @atlas
 * @kind controller
 * @partOf feature:users, feature:auth
 * @uses primitive:routeTemplates
 */
import { makeController } from '#/lib/utils/makeController';
import { meSignOutRoute } from '#/modules/me/routes/meSignOut';
import { signOutEverywhere } from '#/modules/user/services/signOutEverywhere';

export const meSignOutController = makeController(meSignOutRoute, async (c, respond) => {
  await signOutEverywhere(c.get('user')!.id);
  return respond.noContent();
});
