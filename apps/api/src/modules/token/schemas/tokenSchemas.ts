/**
 * @atlas
 * @kind schema
 * @partOf feature:auth
 * @uses none
 */
import { z } from '@hono/zod-openapi';
import { TokenScalarSchema } from '@template/db';
import { IntegrationReach, Role } from '@template/db/generated/client/enums';

export const tokenCreateBodySchema = z.object({
  name: z.string().min(1).max(100),
  role: z.nativeEnum(Role),
  entitlements: z.record(z.string(), z.boolean()).nullable().optional(),
  entitlementsOnly: z.boolean().optional(),
  expiresAt: z.coerce.date().optional(),
  integrationReach: z.nativeEnum(IntegrationReach).optional(),
  integrationReachIds: z.array(z.string()).optional(),
});

export const tokenUpdateBodySchema = tokenCreateBodySchema.omit({ expiresAt: true }).partial();

export const tokenCreateResponseSchema = TokenScalarSchema.omit({ keyHash: true }).extend({
  key: z.string(),
});

export const tokenReadResponseSchema = TokenScalarSchema.omit({ keyHash: true });
