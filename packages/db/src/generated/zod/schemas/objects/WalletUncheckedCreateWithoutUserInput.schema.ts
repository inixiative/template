import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { ChainSchema } from '../enums/Chain.schema'

const makeSchema = () => z.object({
  id: z.string().optional(),
  address: z.string(),
  chain: ChainSchema.optional(),
  isPrimary: z.boolean().optional(),
  isPayoutWallet: z.boolean().optional(),
  verifiedAt: z.coerce.date().optional().nullable(),
  createdAt: z.coerce.date().optional()
}).strict();
export const WalletUncheckedCreateWithoutUserInputObjectSchema: z.ZodType<Prisma.WalletUncheckedCreateWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.WalletUncheckedCreateWithoutUserInput>;
export const WalletUncheckedCreateWithoutUserInputObjectZodSchema = makeSchema();
