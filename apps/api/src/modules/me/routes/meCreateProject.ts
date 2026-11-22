/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:project
 */
import { createRoute } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';
import {
  PROJECT_IMMUTABLE_FIELDS,
  projectCreateBodySchema,
  projectReadResponseSchema,
} from '#/modules/project/schemas/projectSchemas';

export const meCreateProjectRoute = createRoute({
  model: Modules.me,
  submodel: Modules.project,
  skipId: true,
  middleware: [validateSubmodelPermission('create')],
  bodySchema: projectCreateBodySchema,
  responseSchema: projectReadResponseSchema,
  sanitizeKeys: PROJECT_IMMUTABLE_FIELDS,
  tags: [OpenApiTags.me, OpenApiTags.project],
});
