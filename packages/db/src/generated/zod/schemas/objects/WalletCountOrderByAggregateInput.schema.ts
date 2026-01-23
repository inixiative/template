import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema'

const makeSchema = () => z.object({
  id: SortOrderSchema.optional(),
  userId: SortOrderSchema.optional(),
  address: SortOrderSchema.optional(),
  chain: SortOrderSchema.optional(),
  isPrimary: SortOrderSchema.optional(),
  isPayoutWallet: SortOrderSchema.optional(),
  verifiedAt: SortOrderSchema.optional(),
  createdAt: SortOrderSchema.optional()
}).strict();
export const WalletCountOrderByAggregateInputObjectSchema: z.ZodType<Prisma.WalletCountOrderByAggregateInput> = makeSchema() as unknown as z.ZodType<Prisma.WalletCountOrderByAggregateInput>;
export const WalletCountOrderByAggregateInputObjectZodSchema = makeSchema();
