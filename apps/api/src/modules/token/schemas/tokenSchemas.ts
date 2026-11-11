/**
 * @atlas
 * @kind schema
 * @partOf feature:auth
 * @uses none
 */
import { z } from '@hono/zod-openapi';
import { EntitlementScalarSchema, TokenScalarSchema } from '@template/db';
import { Role } from '@template/db/generated/client/enums';
import { entitlementInputsSchema } from '@template/permissions/rebac';

export const tokenCreateBodySchema = z.object({
  name: z.string().min(1).max(100),
  role: z.nativeEnum(Role).nullable().default(null),
  full: z.boolean().default(false),
  entitlements: entitlementInputsSchema.default([]),
  expiresAt: z.coerce.date().optional(),
});

export const tokenReadResponseSchema = TokenScalarSchema.omit({ keyHash: true }).extend({
  targetEntitlements: z.array(EntitlementScalarSchema),
});

export const tokenCreateResponseSchema = tokenReadResponseSchema.extend({ key: z.string() });
