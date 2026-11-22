/**
 * @atlas
 * @kind route
 * @partOf feature:project
 * @uses primitive:routeTemplates, primitive:authz
 */
import { ProjectIntegrationScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const projectIntegrationReadRoute = readRoute({
  model: Modules.projectIntegration,
  middleware: [validatePermission('read')],
  responseSchema: ProjectIntegrationScalarSchema,
});
