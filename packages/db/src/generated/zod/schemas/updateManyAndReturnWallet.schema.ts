import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WalletUpdateManyMutationInputObjectSchema as WalletUpdateManyMutationInputObjectSchema } from './objects/WalletUpdateManyMutationInput.schema';
import { WalletWhereInputObjectSchema as WalletWhereInputObjectSchema } from './objects/WalletWhereInput.schema';

export const WalletUpdateManyAndReturnSchema: z.ZodType<Prisma.WalletUpdateManyAndReturnArgs> = z.object({  data: WalletUpdateManyMutationInputObjectSchema, where: WalletWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.WalletUpdateManyAndReturnArgs>;

export const WalletUpdateManyAndReturnZodSchema = z.object({  data: WalletUpdateManyMutationInputObjectSchema, where: WalletWhereInputObjectSchema.optional() }).strict();