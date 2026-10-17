/**
 * @atlas
 * @kind route
 * @partOf feature:integrations, superadmin
 * @uses primitive:routeTemplates
 */
import { IntegrationScalarSchema } from '@template/db';
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const adminIntegrationReadManyRoute = readRoute({
  model: Modules.integration,
  many: true,
  paginate: true,
  skipId: true,
  admin: true,
  filterLens: { parent: lensFor('Integration') },
  responseSchema: IntegrationScalarSchema,
});
