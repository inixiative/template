/**
 * @atlas
 * @kind route
 * @partOf feature:integrations, feature:project
 * @uses primitive:routeTemplates, primitive:authz
 */
import { createRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  integrationCreateProjectIntegrationItemSchema,
  integrationProjectIntegrationResponseSchema,
} from '#/modules/integration/schemas/integrationProjectIntegrationSchemas';
import { Modules } from '#/modules/modules';

export const integrationCreateManyProjectIntegrationsRoute = createRoute({
  model: Modules.integration,
  submodel: Modules.projectIntegration,
  many: true,
  description:
    'Links this Integration (and optional IntegrationResources, with at most one isIdentity resource per link) to existing Projects or newly created Projects in a single transaction.',
  middleware: [validatePermission('operate')],
  bodySchema: integrationCreateProjectIntegrationItemSchema,
  responseSchema: integrationProjectIntegrationResponseSchema,
});
