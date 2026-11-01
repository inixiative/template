/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:project
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import { Modules } from '#/modules/modules';
import { projectReadResponseSchema } from '#/modules/project/schemas/projectSchemas';

export const spaceUserReadManyProjectsRoute = readRoute({
  model: Modules.spaceUser,
  submodel: Modules.project,
  many: true,
  paginate: true,
  filterLens: { parent: lensFor('Project') },
  responseSchema: projectReadResponseSchema,
  middleware: [validateSubmodelPermission('read')],
});
