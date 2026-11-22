/**
 * @atlas
 * @kind route
 * @partOf feature:project
 * @uses primitive:routeTemplates, primitive:authz
 */
import { ProjectIntegrationScalarSchema } from '@template/db';
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const projectReadManyProjectIntegrationsRoute = readRoute({
  model: Modules.project,
  submodel: Modules.projectIntegration,
  many: true,
  paginate: true,
  filterLens: { parent: lensFor('ProjectIntegration') },
  middleware: [validatePermission('read')],
  responseSchema: ProjectIntegrationScalarSchema,
});
