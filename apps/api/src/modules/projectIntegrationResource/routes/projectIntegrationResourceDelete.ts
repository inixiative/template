/**
 * @atlas
 * @kind route
 * @partOf feature:project
 * @uses primitive:routeTemplates, primitive:authz
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const projectIntegrationResourceDeleteRoute = deleteRoute({
  model: Modules.projectIntegrationResource,
  middleware: [validatePermission('delete')],
});
