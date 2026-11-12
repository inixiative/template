/**
 * @atlas
 * @kind route
 * @partOf primitive:flows
 * @uses primitive:routeTemplates, primitive:authz
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const flowDeleteRoute = deleteRoute({
  model: Modules.flow,
  middleware: [validatePermission('operate')],
});
