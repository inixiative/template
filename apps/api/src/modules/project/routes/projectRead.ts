/**
 * @atlas
 * @kind route
 * @partOf feature:project
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { projectReadResponseSchema } from '#/modules/project/schemas/projectSchemas';

export const projectReadRoute = readRoute({
  model: Modules.project,
  middleware: [validatePermission('read')],
  responseSchema: projectReadResponseSchema,
});
