/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, primitive:authz
 */
import { entitlementEntrySchema, entitlementRowSchema } from '@template/permissions/rebac';
import { createRoute, permissionsBodyRefinement } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const organizationUserCreateManyEntitlementsRoute = createRoute({
  model: Modules.organizationUser,
  submodel: Modules.entitlement,
  many: true,
  description: 'Grants entitlements to a member; answers with every entitlement it holds.',
  bodyRefinement: permissionsBodyRefinement,
  bodySchema: entitlementEntrySchema,
  responseSchema: entitlementRowSchema,
});
