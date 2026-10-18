/**
 * @atlas
 * @kind controller
 * @partOf feature:users, feature:auth, superadmin
 * @uses primitive:routeTemplates
 */
import { revokeUserJwts } from '#/lib/auth/jwtRevocation';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { adminUserSignOutRoute } from '#/modules/user/routes/adminUserSignOut';

export const adminUserSignOutController = makeController(
  adminUserSignOutRoute,
  async (c, respond) => {
    await revokeUserJwts(getResource<'user'>(c).id);
    return respond.noContent();
  },
);
