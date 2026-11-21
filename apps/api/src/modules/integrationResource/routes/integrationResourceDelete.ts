/**
 * @atlas
 * @kind route
 * @partOf feature:integrations
 * @uses primitive:routeTemplates, primitive:authz
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { integrationResourceReadResponseSchema } from '#/modules/integration/schemas/integrationResourceSchemas';
import { Modules } from '#/modules/modules';

export const integrationResourceDeleteRoute = deleteRoute({
  model: Modules.integrationResource,
  middleware: [validatePermission('delete')],
  responseSchema: integrationResourceReadResponseSchema,
});
