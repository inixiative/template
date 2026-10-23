/**
 * @atlas
 * @kind route
 * @partOf feature:users, feature:auth, superadmin
 * @uses primitive:routeTemplates
 */
import { actionRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const adminUserRotateJwtsRoute = actionRoute({
  model: Modules.user,
  action: 'rotateJwts',
  admin: true,
  description:
    "Rotates the user's JWT version: every JWT this API has signed for them, on every device, stops working",
});
