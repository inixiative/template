import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { TokenSelectObjectSchema as TokenSelectObjectSchema } from './objects/TokenSelect.schema';
import { TokenIncludeObjectSchema as TokenIncludeObjectSchema } from './objects/TokenInclude.schema';
import { TokenUpdateInputObjectSchema as TokenUpdateInputObjectSchema } from './objects/TokenUpdateInput.schema';
import { TokenUncheckedUpdateInputObjectSchema as TokenUncheckedUpdateInputObjectSchema } from './objects/TokenUncheckedUpdateInput.schema';
import { TokenWhereUniqueInputObjectSchema as TokenWhereUniqueInputObjectSchema } from './objects/TokenWhereUniqueInput.schema';

export const TokenUpdateOneSchema: z.ZodType<Prisma.TokenUpdateArgs> = z.object({ select: TokenSelectObjectSchema.optional(), include: TokenIncludeObjectSchema.optional(), data: z.union([TokenUpdateInputObjectSchema, TokenUncheckedUpdateInputObjectSchema]), where: TokenWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.TokenUpdateArgs>;

export const TokenUpdateOneZodSchema = z.object({ select: TokenSelectObjectSchema.optional(), include: TokenIncludeObjectSchema.optional(), data: z.union([TokenUpdateInputObjectSchema, TokenUncheckedUpdateInputObjectSchema]), where: TokenWhereUniqueInputObjectSchema }).strict();