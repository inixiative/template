import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema as SortOrderInputObjectSchema } from './SortOrderInput.schema';
import { TokenCountOrderByAggregateInputObjectSchema as TokenCountOrderByAggregateInputObjectSchema } from './TokenCountOrderByAggregateInput.schema';
import { TokenMaxOrderByAggregateInputObjectSchema as TokenMaxOrderByAggregateInputObjectSchema } from './TokenMaxOrderByAggregateInput.schema';
import { TokenMinOrderByAggregateInputObjectSchema as TokenMinOrderByAggregateInputObjectSchema } from './TokenMinOrderByAggregateInput.schema'

const makeSchema = () => z.object({
  id: SortOrderSchema.optional(),
  createdAt: SortOrderSchema.optional(),
  updatedAt: SortOrderSchema.optional(),
  name: SortOrderSchema.optional(),
  keyHash: SortOrderSchema.optional(),
  keyPrefix: SortOrderSchema.optional(),
  ownerModel: SortOrderSchema.optional(),
  userId: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  organizationId: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  role: SortOrderSchema.optional(),
  entitlements: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  expiresAt: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  lastUsedAt: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  isActive: SortOrderSchema.optional(),
  _count: z.lazy(() => TokenCountOrderByAggregateInputObjectSchema).optional(),
  _max: z.lazy(() => TokenMaxOrderByAggregateInputObjectSchema).optional(),
  _min: z.lazy(() => TokenMinOrderByAggregateInputObjectSchema).optional()
}).strict();
export const TokenOrderByWithAggregationInputObjectSchema: z.ZodType<Prisma.TokenOrderByWithAggregationInput> = makeSchema() as unknown as z.ZodType<Prisma.TokenOrderByWithAggregationInput>;
export const TokenOrderByWithAggregationInputObjectZodSchema = makeSchema();
