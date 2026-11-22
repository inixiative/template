/**
 * @atlas
 * @kind controller
 * @partOf feature:users, feature:auth, superadmin
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { adminUserRotateJwtsRoute } from '#/modules/user/routes/adminUserRotateJwts';
import { rotateUserJwts } from '#/modules/user/services/rotateUserJwts';

export const adminUserRotateJwtsController = makeController(
  adminUserRotateJwtsRoute,
  async (c, respond) => {
    await rotateUserJwts(contextResource<'user'>(c).id);
    return respond.noContent();
  },
);
