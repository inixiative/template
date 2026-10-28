/**
 * @atlas
 * @kind route
 * @partOf feature:auth
 * @uses primitive:routeTemplates
 */
import { entitlementChangesSchema } from '#/lib/permissions/changeEntitlements';
import { permissionsBodyRefinement, updateRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { tokenReadResponseSchema } from '#/modules/token/schemas/tokenSchemas';

export const tokenEntitlementsRoute = updateRoute({
  model: Modules.token,
  action: 'entitlements',
  description: "Adds and removes a token's entitlements.",
  bodyRefinement: permissionsBodyRefinement,
  bodySchema: entitlementChangesSchema,
  responseSchema: tokenReadResponseSchema,
});
