/**
 * @atlas
 * @kind schema
 * @partOf feature:tenancy
 * @uses primitive:authz
 */
import { z } from '@hono/zod-openapi';
import { EntitlementScalarSchema, SpaceUserScalarSchema } from '@template/db';

export const spaceUserReadResponseSchema = SpaceUserScalarSchema.extend({
  targetEntitlements: z.array(EntitlementScalarSchema),
});
