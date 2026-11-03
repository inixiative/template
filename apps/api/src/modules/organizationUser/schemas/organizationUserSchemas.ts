/**
 * @atlas
 * @kind schema
 * @partOf feature:tenancy
 * @uses primitive:authz
 */
import { OrganizationUserScalarSchema } from '@template/db';
import { entitlementEntriesSchema } from '@template/permissions/rebac';

export const organizationUserReadResponseSchema = OrganizationUserScalarSchema.extend({
  entitlements: entitlementEntriesSchema,
});
