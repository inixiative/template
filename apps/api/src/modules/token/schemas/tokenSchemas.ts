import { z } from '@hono/zod-openapi';
import { TokenScalarSchema } from '@template/db';
import { Role } from '@template/db/generated/client/enums';

export const tokenCreateBodySchema = z.object({
  name: z.string().min(1).max(100),
  role: z.nativeEnum(Role),
  expiresAt: z.coerce.date().optional(),
});

export const tokenCreateResponseSchema = TokenScalarSchema.omit({ keyHash: true }).extend({
  key: z.string(),
});

export const tokenReadResponseSchema = TokenScalarSchema.omit({ keyHash: true });
