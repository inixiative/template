/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, primitive:authz, feature:integrations
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { entitlementScope } from '#/middleware/resources/entitlementScope';
import { scopeNarrowing } from '#/middleware/resources/scopeNarrowing';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { integrationReadResponseSchema } from '#/modules/integration/schemas/integrationSchemas';
import { Modules } from '#/modules/modules';

export const spaceReadManyIntegrationsRoute = readRoute({
  model: Modules.space,
  submodel: Modules.integration,
  many: true,
  paginate: true,
  filterLens: { parent: lensFor('Integration') },
  responseSchema: integrationReadResponseSchema,
  middleware: [validatePermission('read'), scopeNarrowing(entitlementScope('integration'))],
});
