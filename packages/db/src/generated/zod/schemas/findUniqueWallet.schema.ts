import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WalletWhereUniqueInputObjectSchema as WalletWhereUniqueInputObjectSchema } from './objects/WalletWhereUniqueInput.schema';

export const WalletFindUniqueSchema: z.ZodType<Prisma.WalletFindUniqueArgs> = z.object({   where: WalletWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.WalletFindUniqueArgs>;

export const WalletFindUniqueZodSchema = z.object({   where: WalletWhereUniqueInputObjectSchema }).strict();