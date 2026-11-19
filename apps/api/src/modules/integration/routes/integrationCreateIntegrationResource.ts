/**
 * @atlas
 * @kind route
 * @partOf feature:integrations
 * @uses primitive:routeTemplates, feature:auth
 */
import { createRoute } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import {
  integrationResourceCreateBodySchema,
  integrationResourceReadResponseSchema,
} from '#/modules/integration/schemas/integrationResourceSchemas';
import { Modules } from '#/modules/modules';

export const integrationCreateIntegrationResourceRoute = createRoute({
  model: Modules.integration,
  submodel: Modules.integrationResource,
  middleware: [validateSubmodelPermission('create')],
  bodySchema: integrationResourceCreateBodySchema,
  responseSchema: integrationResourceReadResponseSchema,
  description:
    'Registers a provider resource on this integration, named by its `kind` and `externalId`, and links it to `projectId` when one is named. A live resource with the same kind and externalId is a 409; a removed one can be registered again.',
});
