/**
 * @atlas
 * @kind schema
 * @partOf feature:tenancy
 * @uses primitive:authz
 */
import { z } from '@hono/zod-openapi';
import { EntitlementScalarSchema, OrganizationUserScalarSchema } from '@template/db';

export const organizationUserReadResponseSchema = OrganizationUserScalarSchema.extend({
  targetEntitlements: z.array(EntitlementScalarSchema),
});
