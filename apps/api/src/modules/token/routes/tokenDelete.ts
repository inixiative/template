import { deleteRoute } from '#/lib/routeTemplates';
import { validateNotToken } from '#/middleware/validations/validateNotToken';
import { Modules } from '#/modules/modules';

export const tokenDeleteRoute = deleteRoute({
  model: Modules.token,
  // Permission check happens in the controller — `leave` (self deletes own
  // token) and `manage` (owner deletes scoped token) are both valid; the
  // route-level middleware only takes a single action.
  middleware: [validateNotToken],
});
