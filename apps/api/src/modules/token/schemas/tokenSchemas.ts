/**
 * @atlas
 * @kind schema
 * @partOf feature:auth
 * @uses none
 */
import { z } from '@hono/zod-openapi';
import { TokenScalarSchema } from '@template/db';
import { Role } from '@template/db/generated/client/enums';
import { entitlementEntriesSchema } from '@template/permissions/rebac';

export const tokenCreateBodySchema = z.object({
  name: z.string().min(1).max(100),
  role: z.nativeEnum(Role).nullable().default(null),
  full: z.boolean().default(false),
  entitlements: entitlementEntriesSchema.default([]),
  expiresAt: z.coerce.date().optional(),
});

export const tokenReadResponseSchema = TokenScalarSchema.omit({ keyHash: true }).extend({
  entitlements: entitlementEntriesSchema,
});

export const tokenCreateResponseSchema = tokenReadResponseSchema.extend({ key: z.string() });
