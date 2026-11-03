/**
 * @atlas
 * @kind schema
 * @partOf feature:tenancy
 * @uses primitive:authz
 */
import { SpaceUserScalarSchema } from '@template/db';
import { entitlementEntriesSchema } from '@template/permissions/rebac';

export const spaceUserReadResponseSchema = SpaceUserScalarSchema.extend({
  entitlements: entitlementEntriesSchema,
});
