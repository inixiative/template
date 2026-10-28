/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { OrganizationUserScalarInputSchema, OrganizationUserScalarSchema } from '@template/db';
import { entitlementEntriesSchema } from '@template/permissions/rebac';
import { permissionsBodyRefinement, updateRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const organizationUserUpdateRoute = updateRoute({
  model: Modules.organizationUser,
  bodyRefinement: permissionsBodyRefinement,
  bodySchema: OrganizationUserScalarInputSchema.pick({ role: true })
    .extend({ entitlements: entitlementEntriesSchema.nullable() })
    .partial(),
  responseSchema: OrganizationUserScalarSchema,
});
