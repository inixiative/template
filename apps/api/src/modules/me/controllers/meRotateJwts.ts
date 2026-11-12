/**
 * @atlas
 * @kind controller
 * @partOf feature:users, feature:auth
 * @uses primitive:routeTemplates
 */

import { me } from '#/lib/context/me';
import { makeController } from '#/lib/utils/makeController';
import { meRotateJwtsRoute } from '#/modules/me/routes/meRotateJwts';
import { rotateUserJwts } from '#/modules/user/services/rotateUserJwts';

export const meRotateJwtsController = makeController(meRotateJwtsRoute, async (c, respond) => {
  await rotateUserJwts(me(c)!.id);
  return respond.noContent();
});
