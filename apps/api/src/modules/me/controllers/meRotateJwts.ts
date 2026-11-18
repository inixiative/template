/**
 * @atlas
 * @kind controller
 * @partOf feature:users, feature:auth
 * @uses primitive:routeTemplates
 */

import { actingUser } from '#/lib/context/actingUser';
import { makeController } from '#/lib/utils/makeController';
import { meRotateJwtsRoute } from '#/modules/me/routes/meRotateJwts';
import { rotateUserJwts } from '#/modules/user/services/rotateUserJwts';

export const meRotateJwtsController = makeController(meRotateJwtsRoute, async (c, respond) => {
  await rotateUserJwts(actingUser(c)!.id);
  return respond.noContent();
});
