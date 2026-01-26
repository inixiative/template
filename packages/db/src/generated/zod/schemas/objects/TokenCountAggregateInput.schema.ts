import * as z from 'zod';
import type { Prisma } from '../../../client/client';


const makeSchema = () => z.object({
  id: z.literal(true).optional(),
  createdAt: z.literal(true).optional(),
  updatedAt: z.literal(true).optional(),
  name: z.literal(true).optional(),
  keyHash: z.literal(true).optional(),
  keyPrefix: z.literal(true).optional(),
  ownerModel: z.literal(true).optional(),
  userId: z.literal(true).optional(),
  organizationId: z.literal(true).optional(),
  role: z.literal(true).optional(),
  entitlements: z.literal(true).optional(),
  expiresAt: z.literal(true).optional(),
  lastUsedAt: z.literal(true).optional(),
  isActive: z.literal(true).optional(),
  _all: z.literal(true).optional()
}).strict();
export const TokenCountAggregateInputObjectSchema: z.ZodType<Prisma.TokenCountAggregateInputType> = makeSchema() as unknown as z.ZodType<Prisma.TokenCountAggregateInputType>;
export const TokenCountAggregateInputObjectZodSchema = makeSchema();
