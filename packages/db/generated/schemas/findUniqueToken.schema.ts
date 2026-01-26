import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { TokenSelectObjectSchema as TokenSelectObjectSchema } from './objects/TokenSelect.schema';
import { TokenIncludeObjectSchema as TokenIncludeObjectSchema } from './objects/TokenInclude.schema';
import { TokenWhereUniqueInputObjectSchema as TokenWhereUniqueInputObjectSchema } from './objects/TokenWhereUniqueInput.schema';

export const TokenFindUniqueSchema: z.ZodType<Prisma.TokenFindUniqueArgs> = z.object({ select: TokenSelectObjectSchema.optional(), include: TokenIncludeObjectSchema.optional(), where: TokenWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.TokenFindUniqueArgs>;

export const TokenFindUniqueZodSchema = z.object({ select: TokenSelectObjectSchema.optional(), include: TokenIncludeObjectSchema.optional(), where: TokenWhereUniqueInputObjectSchema }).strict();