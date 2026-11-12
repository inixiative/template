/**
 * @atlas
 * @kind route
 * @partOf feature:integrations, superadmin
 * @uses primitive:routeTemplates
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { integrationReadResponseSchema } from '#/modules/integration/schemas/integrationSchemas';
import { Modules } from '#/modules/modules';

export const adminIntegrationReadManyRoute = readRoute({
  model: Modules.integration,
  many: true,
  paginate: true,
  skipId: true,
  admin: true,
  filterLens: { parent: lensFor('Integration') },
  responseSchema: integrationReadResponseSchema,
});
