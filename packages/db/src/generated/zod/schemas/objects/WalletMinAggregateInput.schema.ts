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
  createdAt: z.literal(true).optional()
}).strict();
export const WalletMinAggregateInputObjectSchema: z.ZodType<Prisma.WalletMinAggregateInputType> = makeSchema() as unknown as z.ZodType<Prisma.WalletMinAggregateInputType>;
export const WalletMinAggregateInputObjectZodSchema = makeSchema();
