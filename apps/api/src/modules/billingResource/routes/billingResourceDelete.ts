/**
 * @atlas
 * @kind route
 * @partOf feature:billing
 * @uses primitive:routeTemplates, primitive:authz
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const billingResourceDeleteRoute = deleteRoute({
  model: Modules.billingResource,
  middleware: [validatePermission('delete')],
});
