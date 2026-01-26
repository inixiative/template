import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';


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
  expiresAt: z.literal(true).optional(),
  lastUsedAt: z.literal(true).optional(),
  isActive: z.literal(true).optional()
}).strict();
export const TokenMaxAggregateInputObjectSchema: z.ZodType<Prisma.TokenMaxAggregateInputType> = makeSchema() as unknown as z.ZodType<Prisma.TokenMaxAggregateInputType>;
export const TokenMaxAggregateInputObjectZodSchema = makeSchema();
