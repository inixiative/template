import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { TokenSelectObjectSchema as TokenSelectObjectSchema } from './objects/TokenSelect.schema';
import { TokenIncludeObjectSchema as TokenIncludeObjectSchema } from './objects/TokenInclude.schema';
import { TokenWhereUniqueInputObjectSchema as TokenWhereUniqueInputObjectSchema } from './objects/TokenWhereUniqueInput.schema';

export const TokenFindUniqueOrThrowSchema: z.ZodType<Prisma.TokenFindUniqueOrThrowArgs> = z.object({ select: TokenSelectObjectSchema.optional(), include: TokenIncludeObjectSchema.optional(), where: TokenWhereUniqueInputObjectSchema }).strict() as unknown as z.ZodType<Prisma.TokenFindUniqueOrThrowArgs>;

export const TokenFindUniqueOrThrowZodSchema = z.object({ select: TokenSelectObjectSchema.optional(), include: TokenIncludeObjectSchema.optional(), where: TokenWhereUniqueInputObjectSchema }).strict();