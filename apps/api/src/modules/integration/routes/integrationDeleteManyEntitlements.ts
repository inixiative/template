/**
 * @atlas
 * @kind route
 * @partOf feature:integrations
 * @uses primitive:routeTemplates, primitive:authz
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const integrationDeleteManyEntitlementsRoute = deleteRoute({
  model: Modules.integration,
  submodel: Modules.entitlement,
  many: true,
  description: "Removes an integration's entitlements by id.",
  middleware: [validatePermission('manage')],
});
