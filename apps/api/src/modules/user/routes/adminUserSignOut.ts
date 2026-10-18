/**
 * @atlas
 * @kind route
 * @partOf feature:users, feature:auth, superadmin
 * @uses primitive:routeTemplates
 */
import { actionRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const adminUserSignOutRoute = actionRoute({
  model: Modules.user,
  action: 'signOut',
  admin: true,
  description: 'Signs the user out everywhere: every JWT issued to them until now stops working',
});
