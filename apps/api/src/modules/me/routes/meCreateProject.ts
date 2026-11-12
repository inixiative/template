/**
 * @atlas
 * @kind route
 * @partOf feature:users
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
import { Tags } from '#/modules/tags';

export const meCreateProjectRoute = createRoute({
  model: Modules.me,
  submodel: Modules.project,
  skipId: true,
  middleware: [validateSubmodelPermission('create')],
  bodySchema: projectCreateBodySchema,
  responseSchema: projectReadResponseSchema,
  sanitizeKeys: PROJECT_IMMUTABLE_FIELDS,
  tags: [Tags.me, Tags.project],
});
