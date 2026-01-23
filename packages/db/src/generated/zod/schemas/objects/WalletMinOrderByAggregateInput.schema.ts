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
export const WalletMinOrderByAggregateInputObjectSchema: z.ZodType<Prisma.WalletMinOrderByAggregateInput> = makeSchema() as unknown as z.ZodType<Prisma.WalletMinOrderByAggregateInput>;
export const WalletMinOrderByAggregateInputObjectZodSchema = makeSchema();
