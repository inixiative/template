/**
 * @atlas
 * @kind controller
 * @partOf feature:users, feature:auth, superadmin
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { adminUserSignOutRoute } from '#/modules/user/routes/adminUserSignOut';
import { signOutEverywhere } from '#/modules/user/services/signOutEverywhere';

export const adminUserSignOutController = makeController(
  adminUserSignOutRoute,
  async (c, respond) => {
    await signOutEverywhere(getResource<'user'>(c).id);
    return respond.noContent();
  },
);
