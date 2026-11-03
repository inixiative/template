/**
 * @atlas
 * @kind route
 * @partOf feature:auth
 * @uses primitive:routeTemplates, primitive:authz
 */
import { entitlementEntrySchema, entitlementRowSchema } from '@template/permissions/rebac';
import { createRoute, permissionsBodyRefinement } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const tokenCreateManyEntitlementsRoute = createRoute({
  model: Modules.token,
  submodel: Modules.entitlement,
  many: true,
  description: 'Grants entitlements to a token; answers with every entitlement it holds.',
  bodyRefinement: permissionsBodyRefinement,
  bodySchema: entitlementEntrySchema,
  responseSchema: entitlementRowSchema,
});
