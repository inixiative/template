import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { TokenSelectObjectSchema as TokenSelectObjectSchema } from './objects/TokenSelect.schema';
import { TokenCreateManyInputObjectSchema as TokenCreateManyInputObjectSchema } from './objects/TokenCreateManyInput.schema';

export const TokenCreateManyAndReturnSchema: z.ZodType<Prisma.TokenCreateManyAndReturnArgs> = z.object({ select: TokenSelectObjectSchema.optional(), data: z.union([ TokenCreateManyInputObjectSchema, z.array(TokenCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict() as unknown as z.ZodType<Prisma.TokenCreateManyAndReturnArgs>;

export const TokenCreateManyAndReturnZodSchema = z.object({ select: TokenSelectObjectSchema.optional(), data: z.union([ TokenCreateManyInputObjectSchema, z.array(TokenCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict();