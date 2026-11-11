/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, primitive:authz
 */
import { EntitlementScalarSchema } from '@template/db';
import { entitlementInputSchema } from '@template/permissions/rebac';
import { createRoute, permissionsBodyRefinement } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const spaceUserCreateManyEntitlementsRoute = createRoute({
  model: Modules.spaceUser,
  submodel: Modules.entitlement,
  many: true,
  description: 'Grants entitlements to a space member; answers with every entitlement it holds.',
  bodyRefinement: permissionsBodyRefinement,
  bodySchema: entitlementInputSchema,
  responseSchema: EntitlementScalarSchema,
});
