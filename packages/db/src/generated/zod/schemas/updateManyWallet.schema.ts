import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WalletUpdateManyMutationInputObjectSchema as WalletUpdateManyMutationInputObjectSchema } from './objects/WalletUpdateManyMutationInput.schema';
import { WalletWhereInputObjectSchema as WalletWhereInputObjectSchema } from './objects/WalletWhereInput.schema';

export const WalletUpdateManySchema: z.ZodType<Prisma.WalletUpdateManyArgs> = z.object({ data: WalletUpdateManyMutationInputObjectSchema, where: WalletWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.WalletUpdateManyArgs>;

export const WalletUpdateManyZodSchema = z.object({ data: WalletUpdateManyMutationInputObjectSchema, where: WalletWhereInputObjectSchema.optional() }).strict();