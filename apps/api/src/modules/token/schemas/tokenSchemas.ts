import { z } from '@hono/zod-openapi';
import { OrganizationRole, TokenScalarSchema } from '@template/db';

export const tokenCreateBodySchema = z.object({
  name: z.string().min(1).max(100),
  role: z.nativeEnum(OrganizationRole),
  expiresAt: z.coerce.date().optional(),
});

export const tokenCreateResponseSchema = TokenScalarSchema.omit({ keyHash: true }).extend({
  key: z.string(),
});

export const tokenReadResponseSchema = TokenScalarSchema.omit({ keyHash: true });
