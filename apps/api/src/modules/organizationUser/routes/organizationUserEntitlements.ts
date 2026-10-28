/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { OrganizationUserScalarSchema } from '@template/db';
import { entitlementChangesSchema } from '#/lib/permissions/changeEntitlements';
import { permissionsBodyRefinement, updateRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const organizationUserEntitlementsRoute = updateRoute({
  model: Modules.organizationUser,
  action: 'entitlements',
  description: "Adds and removes a member's entitlements.",
  bodyRefinement: permissionsBodyRefinement,
  bodySchema: entitlementChangesSchema,
  responseSchema: OrganizationUserScalarSchema,
});
