/**
 * @atlas
 * @kind route
 * @partOf feature:project
 * @uses primitive:routeTemplates, primitive:authz
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const projectIntegrationDeleteRoute = deleteRoute({
  model: Modules.projectIntegration,
  middleware: [validatePermission('delete')],
  description: 'Soft-deletes a project-to-integration link.',
});
