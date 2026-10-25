/**
 * @atlas
 * @kind route
 * @partOf feature:auth
 * @uses primitive:routeTemplates
 */

import { SessionAction } from '@template/permissions/client';
import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const tokenDeleteRoute = deleteRoute({
  model: Modules.token,
  // Permission check happens in the controller — `leave` (self deletes own
  // token) and `manage` (owner deletes scoped token) are both valid; the
  // route-level middleware only takes a single action.
  middleware: [validatePermission(SessionAction.deleteToken)],
});
