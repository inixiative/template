/**
 * @atlas
 * @kind route
 * @partOf feature:billing
 * @uses primitive:routeTemplates, primitive:authz
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const billingAccountDeleteRoute = deleteRoute({
  model: Modules.billingAccount,
  middleware: [validatePermission('delete')],
});
