import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { ChainSchema } from '../enums/Chain.schema'

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  address: z.string().max(42),
  chain: ChainSchema.optional(),
  isPrimary: z.boolean().optional(),
  isPayoutWallet: z.boolean().optional(),
  verifiedAt: z.coerce.date().optional().nullable(),
  createdAt: z.coerce.date().optional()
}).strict();
export const WalletCreateWithoutUserInputObjectSchema: z.ZodType<Prisma.WalletCreateWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.WalletCreateWithoutUserInput>;
export const WalletCreateWithoutUserInputObjectZodSchema = makeSchema();
