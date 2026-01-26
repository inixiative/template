import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { TokenSelectObjectSchema as TokenSelectObjectSchema } from './objects/TokenSelect.schema';
import { TokenUpdateManyMutationInputObjectSchema as TokenUpdateManyMutationInputObjectSchema } from './objects/TokenUpdateManyMutationInput.schema';
import { TokenWhereInputObjectSchema as TokenWhereInputObjectSchema } from './objects/TokenWhereInput.schema';

export const TokenUpdateManyAndReturnSchema: z.ZodType<Prisma.TokenUpdateManyAndReturnArgs> = z.object({ select: TokenSelectObjectSchema.optional(), data: TokenUpdateManyMutationInputObjectSchema, where: TokenWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.TokenUpdateManyAndReturnArgs>;

export const TokenUpdateManyAndReturnZodSchema = z.object({ select: TokenSelectObjectSchema.optional(), data: TokenUpdateManyMutationInputObjectSchema, where: TokenWhereInputObjectSchema.optional() }).strict();