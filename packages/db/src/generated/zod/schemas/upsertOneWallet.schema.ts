import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WalletWhereUniqueInputObjectSchema as WalletWhereUniqueInputObjectSchema } from './objects/WalletWhereUniqueInput.schema';
import { WalletCreateInputObjectSchema as WalletCreateInputObjectSchema } from './objects/WalletCreateInput.schema';
import { WalletUncheckedCreateInputObjectSchema as WalletUncheckedCreateInputObjectSchema } from './objects/WalletUncheckedCreateInput.schema';
import { WalletUpdateInputObjectSchema as WalletUpdateInputObjectSchema } from './objects/WalletUpdateInput.schema';
import { WalletUncheckedUpdateInputObjectSchema as WalletUncheckedUpdateInputObjectSchema } from './objects/WalletUncheckedUpdateInput.schema';

export const WalletUpsertOneSchema: z.ZodType<Prisma.WalletUpsertArgs> = z.object({   where: WalletWhereUniqueInputObjectSchema, create: z.union([ WalletCreateInputObjectSchema, WalletUncheckedCreateInputObjectSchema ]), update: z.union([ WalletUpdateInputObjectSchema, WalletUncheckedUpdateInputObjectSchema ]) }).strict() as unknown as z.ZodType<Prisma.WalletUpsertArgs>;

export const WalletUpsertOneZodSchema = z.object({   where: WalletWhereUniqueInputObjectSchema, create: z.union([ WalletCreateInputObjectSchema, WalletUncheckedCreateInputObjectSchema ]), update: z.union([ WalletUpdateInputObjectSchema, WalletUncheckedUpdateInputObjectSchema ]) }).strict();