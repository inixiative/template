import * as z from 'zod';
import type { Prisma } from '../../../client/client';


const makeSchema = () => z.object({
  id: z.literal(true).optional(),
  userId: z.literal(true).optional(),
  address: z.literal(true).optional(),
  chain: z.literal(true).optional(),
  isPrimary: z.literal(true).optional(),
  isPayoutWallet: z.literal(true).optional(),
  verifiedAt: z.literal(true).optional(),
  createdAt: z.literal(true).optional(),
  _all: z.literal(true).optional()
}).strict();
export const WalletCountAggregateInputObjectSchema: z.ZodType<Prisma.WalletCountAggregateInputType> = makeSchema() as unknown as z.ZodType<Prisma.WalletCountAggregateInputType>;
export const WalletCountAggregateInputObjectZodSchema = makeSchema();
