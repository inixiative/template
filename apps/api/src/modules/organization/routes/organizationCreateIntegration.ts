/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:integrations
 */
import { createRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  INTEGRATION_IMMUTABLE_FIELDS,
  integrationCreateBodySchema,
  integrationReadResponseSchema,
} from '#/modules/integration/schemas/integrationSchemas';
import { Modules } from '#/modules/modules';

export const organizationCreateIntegrationRoute = createRoute({
  model: Modules.organization,
  submodel: Modules.integration,
  bodySchema: integrationCreateBodySchema,
  responseSchema: integrationReadResponseSchema,
  middleware: [validatePermission('manage')],
  sanitizeKeys: INTEGRATION_IMMUTABLE_FIELDS,
});
