/**
 * @atlas
 * @kind route
 * @partOf feature:project, superadmin
 * @uses primitive:routeTemplates
 */
import { ProjectIntegrationScalarSchema } from '@template/db';
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const adminProjectIntegrationReadManyRoute = readRoute({
  model: Modules.projectIntegration,
  many: true,
  paginate: true,
  skipId: true,
  admin: true,
  filterLens: { parent: lensFor('ProjectIntegration') },
  responseSchema: ProjectIntegrationScalarSchema,
});
