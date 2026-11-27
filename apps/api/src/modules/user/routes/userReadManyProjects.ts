/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:project
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { projectReadResponseSchema } from '#/modules/project/schemas/projectSchemas';

export const userReadManyProjectsRoute = readRoute({
  model: Modules.user,
  submodel: Modules.project,
  many: true,
  paginate: true,
  filterLens: { parent: lensFor('Project') },
  responseSchema: projectReadResponseSchema,
});
