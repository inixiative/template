/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { SpaceUserScalarInputSchema, SpaceUserScalarSchema } from '@template/db';
import { entitlementEntriesSchema } from '@template/permissions/rebac';
import { updateRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const spaceUserUpdateRoute = updateRoute({
  model: Modules.spaceUser,
  bodySchema: SpaceUserScalarInputSchema.pick({ role: true })
    .extend({ entitlements: entitlementEntriesSchema.nullable() })
    .partial(),
  responseSchema: SpaceUserScalarSchema,
});
