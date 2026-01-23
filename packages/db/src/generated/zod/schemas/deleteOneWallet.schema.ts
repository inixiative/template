import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WalletWhereUniqueInputObjectSchema as WalletWhereUniqueInputObjectSchema } from './objects/WalletWhereUniqueInput.schema';

export const WalletDeleteOneSchema: z.ZodType<Prisma.WalletDeleteArgs> = z.object({   where: WalletWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.WalletDeleteArgs>;

export const WalletDeleteOneZodSchema = z.object({   where: WalletWhereUniqueInputObjectSchema }).strict();