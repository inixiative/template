/**
 * @atlas
 * @kind controller
 * @partOf feature:users, feature:auth
 * @uses primitive:routeTemplates
 */
import { makeController } from '#/lib/utils/makeController';
import { meRotateJwtsRoute } from '#/modules/me/routes/meRotateJwts';
import { rotateUserJwts } from '#/modules/user/services/rotateUserJwts';

export const meRotateJwtsController = makeController(meRotateJwtsRoute, async (c, respond) => {
  await rotateUserJwts(c.get('user')!.id);
  return respond.noContent();
});
