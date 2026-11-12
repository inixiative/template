/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:project
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import { Modules } from '#/modules/modules';
import { projectReadResponseSchema } from '#/modules/project/schemas/projectSchemas';
import { Tags } from '#/modules/tags';

export const meReadManyProjectsRoute = readRoute({
  model: Modules.me,
  submodel: Modules.project,
  many: true,
  skipId: true,
  paginate: true,
  filterLens: { parent: lensFor('Project') },
  responseSchema: projectReadResponseSchema,
  middleware: [validateSubmodelPermission('read')],
  tags: [Tags.me, Tags.project],
});
