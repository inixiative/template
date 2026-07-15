/**
 * @atlas
 * @kind route
 * @partOf feature:integrations
 * @uses primitive:routeTemplates, primitive:authz
 */
import { IntegrationScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const integrationReadRoute = readRoute({
  model: Modules.integration,
  middleware: [validatePermission('read')],
  responseSchema: IntegrationScalarSchema,
});
