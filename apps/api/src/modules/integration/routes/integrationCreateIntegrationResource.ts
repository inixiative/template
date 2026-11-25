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
    "Registers a provider resource on this integration, named by its `kind` and `externalId`, which must be a kind the integration's provider has with an identifier and `metadata` of the shapes the provider declares (422 otherwise; the catalog is `@inixiative/integrations`), and links it to `projectId` when one is named. Registering a kind and externalId the integration already holds refreshes its name and metadata; a removed one is revived, with the project links that were removed with it. A removed untracked resource comes back only when a person sends `status: 'tracked'` (409 otherwise).",
});
