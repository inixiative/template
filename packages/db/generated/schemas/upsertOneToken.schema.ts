import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { TokenSelectObjectSchema as TokenSelectObjectSchema } from './objects/TokenSelect.schema';
import { TokenIncludeObjectSchema as TokenIncludeObjectSchema } from './objects/TokenInclude.schema';
import { TokenWhereUniqueInputObjectSchema as TokenWhereUniqueInputObjectSchema } from './objects/TokenWhereUniqueInput.schema';
import { TokenCreateInputObjectSchema as TokenCreateInputObjectSchema } from './objects/TokenCreateInput.schema';
import { TokenUncheckedCreateInputObjectSchema as TokenUncheckedCreateInputObjectSchema } from './objects/TokenUncheckedCreateInput.schema';
import { TokenUpdateInputObjectSchema as TokenUpdateInputObjectSchema } from './objects/TokenUpdateInput.schema';
import { TokenUncheckedUpdateInputObjectSchema as TokenUncheckedUpdateInputObjectSchema } from './objects/TokenUncheckedUpdateInput.schema';

export const TokenUpsertOneSchema: z.ZodType<Prisma.TokenUpsertArgs> = z.object({ select: TokenSelectObjectSchema.optional(), include: TokenIncludeObjectSchema.optional(), where: TokenWhereUniqueInputObjectSchema, create: z.union([ TokenCreateInputObjectSchema, TokenUncheckedCreateInputObjectSchema ]), update: z.union([ TokenUpdateInputObjectSchema, TokenUncheckedUpdateInputObjectSchema ]) }).strict() as unknown as z.ZodType<Prisma.TokenUpsertArgs>;

export const TokenUpsertOneZodSchema = z.object({ select: TokenSelectObjectSchema.optional(), include: TokenIncludeObjectSchema.optional(), where: TokenWhereUniqueInputObjectSchema, create: z.union([ TokenCreateInputObjectSchema, TokenUncheckedCreateInputObjectSchema ]), update: z.union([ TokenUpdateInputObjectSchema, TokenUncheckedUpdateInputObjectSchema ]) }).strict();