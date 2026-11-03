/**
 * @atlas
 * @kind route
 * @partOf feature:integrations
 * @uses primitive:routeTemplates, primitive:authz
 */
import { entitlementEntrySchema, entitlementRowSchema } from '@template/permissions/rebac';
import { createRoute, permissionsBodyRefinement } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const integrationCreateManyEntitlementsRoute = createRoute({
  model: Modules.integration,
  submodel: Modules.entitlement,
  many: true,
  description: 'Grants entitlements to an integration; answers with every entitlement it holds.',
  middleware: [validatePermission('manage')],
  bodyRefinement: permissionsBodyRefinement,
  bodySchema: entitlementEntrySchema,
  responseSchema: entitlementRowSchema,
});
