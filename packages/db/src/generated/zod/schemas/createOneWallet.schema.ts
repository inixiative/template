import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WalletCreateInputObjectSchema as WalletCreateInputObjectSchema } from './objects/WalletCreateInput.schema';
import { WalletUncheckedCreateInputObjectSchema as WalletUncheckedCreateInputObjectSchema } from './objects/WalletUncheckedCreateInput.schema';

export const WalletCreateOneSchema: z.ZodType<Prisma.WalletCreateArgs> = z.object({   data: z.union([WalletCreateInputObjectSchema, WalletUncheckedCreateInputObjectSchema]) }).strict() as unknown as z.ZodType<Prisma.WalletCreateArgs>;

export const WalletCreateOneZodSchema = z.object({   data: z.union([WalletCreateInputObjectSchema, WalletUncheckedCreateInputObjectSchema]) }).strict();