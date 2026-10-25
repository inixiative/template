/**
 * @atlas
 * @kind route
 * @partOf feature:auth
 * @uses primitive:routeTemplates
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const authProviderDeleteRoute = deleteRoute({
  model: Modules.authProvider,
  middleware: [validatePermission('own')],
});
