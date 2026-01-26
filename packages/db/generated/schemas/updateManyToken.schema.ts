import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { TokenUpdateManyMutationInputObjectSchema as TokenUpdateManyMutationInputObjectSchema } from './objects/TokenUpdateManyMutationInput.schema';
import { TokenWhereInputObjectSchema as TokenWhereInputObjectSchema } from './objects/TokenWhereInput.schema';

export const TokenUpdateManySchema: z.ZodType<Prisma.TokenUpdateManyArgs> = z.object({ data: TokenUpdateManyMutationInputObjectSchema, where: TokenWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.TokenUpdateManyArgs>;

export const TokenUpdateManyZodSchema = z.object({ data: TokenUpdateManyMutationInputObjectSchema, where: TokenWhereInputObjectSchema.optional() }).strict();