import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WalletWhereInputObjectSchema as WalletWhereInputObjectSchema } from './objects/WalletWhereInput.schema';

export const WalletDeleteManySchema: z.ZodType<Prisma.WalletDeleteManyArgs> = z.object({ where: WalletWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.WalletDeleteManyArgs>;

export const WalletDeleteManyZodSchema = z.object({ where: WalletWhereInputObjectSchema.optional() }).strict();