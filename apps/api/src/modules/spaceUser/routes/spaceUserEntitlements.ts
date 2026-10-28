/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { SpaceUserScalarSchema } from '@template/db';
import { entitlementChangesSchema } from '#/lib/permissions/changeEntitlements';
import { permissionsBodyRefinement, updateRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const spaceUserEntitlementsRoute = updateRoute({
  model: Modules.spaceUser,
  action: 'entitlements',
  description: "Adds and removes a space member's entitlements.",
  bodyRefinement: permissionsBodyRefinement,
  bodySchema: entitlementChangesSchema,
  responseSchema: SpaceUserScalarSchema,
});
