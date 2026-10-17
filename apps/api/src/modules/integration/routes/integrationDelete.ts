/**
 * @atlas
 * @kind route
 * @partOf feature:integrations
 * @uses primitive:routeTemplates, primitive:authz
 */
import { IntegrationScalarSchema } from '@template/db';
import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const integrationDeleteRoute = deleteRoute({
  model: Modules.integration,
  middleware: [validatePermission('manage')],
  responseSchema: IntegrationScalarSchema,
});
