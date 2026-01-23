import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema as SortOrderInputObjectSchema } from './SortOrderInput.schema';
import { UserOrderByWithRelationInputObjectSchema as UserOrderByWithRelationInputObjectSchema } from './UserOrderByWithRelationInput.schema'

const makeSchema = () => z.object({
  id: SortOrderSchema.optional(),
  userId: SortOrderSchema.optional(),
  address: SortOrderSchema.optional(),
  chain: SortOrderSchema.optional(),
  isPrimary: SortOrderSchema.optional(),
  isPayoutWallet: SortOrderSchema.optional(),
  verifiedAt: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  createdAt: SortOrderSchema.optional(),
  user: z.lazy(() => UserOrderByWithRelationInputObjectSchema).optional()
}).strict();
export const WalletOrderByWithRelationInputObjectSchema: z.ZodType<Prisma.WalletOrderByWithRelationInput> = makeSchema() as unknown as z.ZodType<Prisma.WalletOrderByWithRelationInput>;
export const WalletOrderByWithRelationInputObjectZodSchema = makeSchema();
