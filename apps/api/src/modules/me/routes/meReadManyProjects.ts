/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:project
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';
import { projectReadResponseSchema } from '#/modules/project/schemas/projectSchemas';

export const meReadManyProjectsRoute = readRoute({
  model: Modules.me,
  submodel: Modules.project,
  many: true,
  skipId: true,
  paginate: true,
  filterLens: { parent: lensFor('Project') },
  responseSchema: projectReadResponseSchema,
  tags: [OpenApiTags.me, OpenApiTags.project],
});
