/**
 * @atlas
 * @kind controller
 * @partOf feature:users, feature:auth, superadmin
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { adminUserRotateJwtsRoute } from '#/modules/user/routes/adminUserRotateJwts';
import { rotateUserJwts } from '#/modules/user/services/rotateUserJwts';

export const adminUserRotateJwtsController = makeController(
  adminUserRotateJwtsRoute,
  async (c, respond) => {
    await rotateUserJwts(getResource<'user'>(c).id);
    return respond.noContent();
  },
);
