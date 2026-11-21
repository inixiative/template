/**
 * @atlas
 * @kind route
 * @partOf feature:integrations
 * @uses primitive:routeTemplates
 */
import { updateRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { integrationResourceReadResponseSchema } from '#/modules/integration/schemas/integrationResourceSchemas';
import { integrationResourceUpdateBodySchema } from '#/modules/integrationResource/schemas/integrationResourceUpdateSchemas';
import { Modules } from '#/modules/modules';

export const integrationResourceUpdateRoute = updateRoute({
  model: Modules.integrationResource,
  middleware: [validatePermission('manage')],
  bodySchema: integrationResourceUpdateBodySchema,
  responseSchema: integrationResourceReadResponseSchema,
});
