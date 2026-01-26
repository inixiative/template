import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { TokenWhereInputObjectSchema as TokenWhereInputObjectSchema } from './objects/TokenWhereInput.schema';

export const TokenDeleteManySchema: z.ZodType<Prisma.TokenDeleteManyArgs> = z.object({ where: TokenWhereInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.TokenDeleteManyArgs>;

export const TokenDeleteManyZodSchema = z.object({ where: TokenWhereInputObjectSchema.optional() }).strict();