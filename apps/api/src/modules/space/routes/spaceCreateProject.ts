/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:project
 */
import { createRoute } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import { Modules } from '#/modules/modules';
import {
  PROJECT_IMMUTABLE_FIELDS,
  projectCreateBodySchema,
  projectReadResponseSchema,
} from '#/modules/project/schemas/projectSchemas';

export const spaceCreateProjectRoute = createRoute({
  model: Modules.space,
  submodel: Modules.project,
  middleware: [validateSubmodelPermission('create')],
  bodySchema: projectCreateBodySchema,
  responseSchema: projectReadResponseSchema,
  sanitizeKeys: PROJECT_IMMUTABLE_FIELDS,
});
