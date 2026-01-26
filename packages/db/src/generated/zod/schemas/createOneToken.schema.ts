import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { TokenSelectObjectSchema as TokenSelectObjectSchema } from './objects/TokenSelect.schema';
import { TokenIncludeObjectSchema as TokenIncludeObjectSchema } from './objects/TokenInclude.schema';
import { TokenCreateInputObjectSchema as TokenCreateInputObjectSchema } from './objects/TokenCreateInput.schema';
import { TokenUncheckedCreateInputObjectSchema as TokenUncheckedCreateInputObjectSchema } from './objects/TokenUncheckedCreateInput.schema';

export const TokenCreateOneSchema: z.ZodType<Prisma.TokenCreateArgs> = z.object({ select: TokenSelectObjectSchema.optional(), include: TokenIncludeObjectSchema.optional(), data: z.union([TokenCreateInputObjectSchema, TokenUncheckedCreateInputObjectSchema]) }).strict() as unknown as z.ZodType<Prisma.TokenCreateArgs>;

export const TokenCreateOneZodSchema = z.object({ select: TokenSelectObjectSchema.optional(), include: TokenIncludeObjectSchema.optional(), data: z.union([TokenCreateInputObjectSchema, TokenUncheckedCreateInputObjectSchema]) }).strict();