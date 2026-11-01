/**
 * @atlas
 * @kind route
 * @partOf feature:project, superadmin
 * @uses primitive:routeTemplates
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { projectReadResponseSchema } from '#/modules/project/schemas/projectSchemas';

export const adminProjectReadManyRoute = readRoute({
  model: Modules.project,
  many: true,
  paginate: true,
  skipId: true,
  admin: true,
  filterLens: { parent: lensFor('Project') },
  responseSchema: projectReadResponseSchema,
});
