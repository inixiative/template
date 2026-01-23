import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WalletWhereUniqueInputObjectSchema as WalletWhereUniqueInputObjectSchema } from './objects/WalletWhereUniqueInput.schema';

export const WalletFindUniqueOrThrowSchema: z.ZodType<Prisma.WalletFindUniqueOrThrowArgs> = z.object({   where: WalletWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.WalletFindUniqueOrThrowArgs>;

export const WalletFindUniqueOrThrowZodSchema = z.object({   where: WalletWhereUniqueInputObjectSchema }).strict();