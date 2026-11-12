/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:integrations
 */
import { createRoute, permissionsBodyRefinement } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import {
  INTEGRATION_IMMUTABLE_FIELDS,
  integrationCreateBodySchema,
  integrationReadResponseSchema,
} from '#/modules/integration/schemas/integrationSchemas';
import { Modules } from '#/modules/modules';

export const spaceCreateIntegrationRoute = createRoute({
  model: Modules.space,
  submodel: Modules.integration,
  bodyRefinement: permissionsBodyRefinement,
  bodySchema: integrationCreateBodySchema,
  responseSchema: integrationReadResponseSchema,
  middleware: [validateSubmodelPermission('create')],
  sanitizeKeys: INTEGRATION_IMMUTABLE_FIELDS,
});
