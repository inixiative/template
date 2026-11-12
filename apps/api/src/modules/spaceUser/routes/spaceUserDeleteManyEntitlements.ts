/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, primitive:authz
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const spaceUserDeleteManyEntitlementsRoute = deleteRoute({
  model: Modules.spaceUser,
  submodel: Modules.entitlement,
  many: true,
  description: "Removes a space member's entitlements by id.",
});
