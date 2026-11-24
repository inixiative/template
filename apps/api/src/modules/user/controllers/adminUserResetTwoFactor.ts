/**
 * @atlas
 * @kind controller
 * @partOf feature:users, feature:auth, superadmin
 * @uses primitive:routeTemplates
 */

import { contextResource } from '#/lib/context/contextResource';
import { resetUserTwoFactor } from '#/lib/twoFactor/resetUserTwoFactor';
import { makeController } from '#/lib/utils/makeController';
import { adminUserResetTwoFactorRoute } from '#/modules/user/routes/adminUserResetTwoFactor';

export const adminUserResetTwoFactorController = makeController(
  adminUserResetTwoFactorRoute,
  async (c, respond) => {
    await resetUserTwoFactor(contextResource<'user'>(c).id);
    return respond.noContent();
  },
);
