/**
 * @atlas
 * @kind route
 * @partOf feature:project
 * @uses primitive:routeTemplates, primitive:authz
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { projectReadResponseSchema } from '#/modules/project/schemas/projectSchemas';

export const projectDeleteRoute = deleteRoute({
  model: Modules.project,
  middleware: [validatePermission('delete')],
  responseSchema: projectReadResponseSchema,
});
