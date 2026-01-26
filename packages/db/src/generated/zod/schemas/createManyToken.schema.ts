import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { TokenCreateManyInputObjectSchema as TokenCreateManyInputObjectSchema } from './objects/TokenCreateManyInput.schema';

export const TokenCreateManySchema: z.ZodType<Prisma.TokenCreateManyArgs> = z.object({ data: z.union([ TokenCreateManyInputObjectSchema, z.array(TokenCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict() as unknown as z.ZodType<Prisma.TokenCreateManyArgs>;

export const TokenCreateManyZodSchema = z.object({ data: z.union([ TokenCreateManyInputObjectSchema, z.array(TokenCreateManyInputObjectSchema) ]), skipDuplicates: z.boolean().optional() }).strict();