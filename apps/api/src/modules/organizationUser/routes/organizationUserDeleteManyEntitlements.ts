/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, primitive:authz
 */
import { deleteRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const organizationUserDeleteManyEntitlementsRoute = deleteRoute({
  model: Modules.organizationUser,
  submodel: Modules.entitlement,
  many: true,
  description: "Removes a member's entitlements by id.",
});
