/**
 * @atlas
 * @kind route
 * @partOf feature:integrations
 * @uses primitive:routeTemplates, primitive:authz
 */
import { IntegrationScalarSchema } from '@template/db';
import { entitlementChangesSchema } from '#/lib/permissions/changeEntitlements';
import { permissionsBodyRefinement, updateRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const integrationEntitlementsRoute = updateRoute({
  model: Modules.integration,
  action: 'entitlements',
  description: "Adds and removes an integration's entitlements.",
  middleware: [validatePermission('manage')],
  bodyRefinement: permissionsBodyRefinement,
  bodySchema: entitlementChangesSchema,
  responseSchema: IntegrationScalarSchema,
});
