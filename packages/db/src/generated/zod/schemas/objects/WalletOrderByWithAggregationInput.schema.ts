import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema as SortOrderInputObjectSchema } from './SortOrderInput.schema';
import { WalletCountOrderByAggregateInputObjectSchema as WalletCountOrderByAggregateInputObjectSchema } from './WalletCountOrderByAggregateInput.schema';
import { WalletMaxOrderByAggregateInputObjectSchema as WalletMaxOrderByAggregateInputObjectSchema } from './WalletMaxOrderByAggregateInput.schema';
import { WalletMinOrderByAggregateInputObjectSchema as WalletMinOrderByAggregateInputObjectSchema } from './WalletMinOrderByAggregateInput.schema'

const makeSchema = () => z.object({
  id: SortOrderSchema.optional(),
  userId: SortOrderSchema.optional(),
  address: SortOrderSchema.optional(),
  chain: SortOrderSchema.optional(),
  isPrimary: SortOrderSchema.optional(),
  isPayoutWallet: SortOrderSchema.optional(),
  verifiedAt: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  createdAt: SortOrderSchema.optional(),
  _count: z.lazy(() => WalletCountOrderByAggregateInputObjectSchema).optional(),
  _max: z.lazy(() => WalletMaxOrderByAggregateInputObjectSchema).optional(),
  _min: z.lazy(() => WalletMinOrderByAggregateInputObjectSchema).optional()
}).strict();
export const WalletOrderByWithAggregationInputObjectSchema: z.ZodType<Prisma.WalletOrderByWithAggregationInput> = makeSchema() as unknown as z.ZodType<Prisma.WalletOrderByWithAggregationInput>;
export const WalletOrderByWithAggregationInputObjectZodSchema = makeSchema();
