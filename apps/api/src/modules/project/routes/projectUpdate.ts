/**
 * @atlas
 * @kind route
 * @partOf feature:project
 * @uses primitive:routeTemplates, primitive:authz
 */
import { updateRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import {
  PROJECT_IMMUTABLE_FIELDS,
  projectReadResponseSchema,
  projectUpdateBodySchema,
} from '#/modules/project/schemas/projectSchemas';

export const projectUpdateRoute = updateRoute({
  model: Modules.project,
  middleware: [validatePermission('manage')],
  bodySchema: projectUpdateBodySchema,
  sanitizeKeys: PROJECT_IMMUTABLE_FIELDS,
  responseSchema: projectReadResponseSchema,
});
