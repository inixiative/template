/**
 * @atlas
 * @kind route
 * @partOf feature:integrations
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { integrationReadResponseSchema } from '#/modules/integration/schemas/integrationSchemas';
import { Modules } from '#/modules/modules';

export const integrationReadRoute = readRoute({
  model: Modules.integration,
  middleware: [validatePermission('read')],
  responseSchema: integrationReadResponseSchema,
});
