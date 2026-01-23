import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { ChainSchema } from '../enums/Chain.schema'

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  userId: z.string().max(36),
  address: z.string().max(42),
  chain: ChainSchema.optional(),
  isPrimary: z.boolean().optional(),
  isPayoutWallet: z.boolean().optional(),
  verifiedAt: z.coerce.date().optional().nullable(),
  createdAt: z.coerce.date().optional()
}).strict();
export const WalletCreateManyInputObjectSchema: z.ZodType<Prisma.WalletCreateManyInput> = makeSchema() as unknown as z.ZodType<Prisma.WalletCreateManyInput>;
export const WalletCreateManyInputObjectZodSchema = makeSchema();
