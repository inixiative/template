/**
 * @atlas
 * @kind route
 * @partOf feature:integrations, feature:project
 * @uses primitive:routeTemplates, primitive:authz
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { integrationProjectIntegrationResponseSchema } from '#/modules/integration/schemas/integrationProjectIntegrationSchemas';
import { Modules } from '#/modules/modules';

export const integrationReadManyProjectIntegrationsRoute = readRoute({
  model: Modules.integration,
  submodel: Modules.projectIntegration,
  many: true,
  paginate: true,
  filterLens: { parent: lensFor('ProjectIntegration') },
  middleware: [validatePermission('read')],
  responseSchema: integrationProjectIntegrationResponseSchema,
  description:
    'List ProjectIntegration records for an integration that the caller can read, including each Project and its not-deleted ProjectIntegrationResources',
});
