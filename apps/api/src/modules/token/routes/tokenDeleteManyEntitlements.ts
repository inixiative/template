/**
 * @atlas
 * @kind route
 * @partOf feature:auth
 * @uses primitive:routeTemplates, primitive:authz
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const tokenDeleteManyEntitlementsRoute = deleteRoute({
  model: Modules.token,
  submodel: Modules.entitlement,
  many: true,
  description: "Removes a token's entitlements by id.",
});
