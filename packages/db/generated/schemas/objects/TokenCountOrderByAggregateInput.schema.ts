import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema'

const makeSchema = () => z.object({
  id: SortOrderSchema.optional(),
  createdAt: SortOrderSchema.optional(),
  updatedAt: SortOrderSchema.optional(),
  name: SortOrderSchema.optional(),
  keyHash: SortOrderSchema.optional(),
  keyPrefix: SortOrderSchema.optional(),
  ownerModel: SortOrderSchema.optional(),
  userId: SortOrderSchema.optional(),
  organizationId: SortOrderSchema.optional(),
  role: SortOrderSchema.optional(),
  entitlements: SortOrderSchema.optional(),
  expiresAt: SortOrderSchema.optional(),
  lastUsedAt: SortOrderSchema.optional(),
  isActive: SortOrderSchema.optional()
}).strict();
export const TokenCountOrderByAggregateInputObjectSchema: z.ZodType<Prisma.TokenCountOrderByAggregateInput> = makeSchema() as unknown as z.ZodType<Prisma.TokenCountOrderByAggregateInput>;
export const TokenCountOrderByAggregateInputObjectZodSchema = makeSchema();
