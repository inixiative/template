import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WalletUpdateInputObjectSchema as WalletUpdateInputObjectSchema } from './objects/WalletUpdateInput.schema';
import { WalletUncheckedUpdateInputObjectSchema as WalletUncheckedUpdateInputObjectSchema } from './objects/WalletUncheckedUpdateInput.schema';
import { WalletWhereUniqueInputObjectSchema as WalletWhereUniqueInputObjectSchema } from './objects/WalletWhereUniqueInput.schema';

export const WalletUpdateOneSchema: z.ZodType<Prisma.WalletUpdateArgs> = z.object({   data: z.union([WalletUpdateInputObjectSchema, WalletUncheckedUpdateInputObjectSchema]), where: WalletWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.WalletUpdateArgs>;

export const WalletUpdateOneZodSchema = z.object({   data: z.union([WalletUpdateInputObjectSchema, WalletUncheckedUpdateInputObjectSchema]), where: WalletWhereUniqueInputObjectSchema }).strict();