import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { TokenOrderByWithRelationInputObjectSchema as TokenOrderByWithRelationInputObjectSchema } from './objects/TokenOrderByWithRelationInput.schema';
import { TokenWhereInputObjectSchema as TokenWhereInputObjectSchema } from './objects/TokenWhereInput.schema';
import { TokenWhereUniqueInputObjectSchema as TokenWhereUniqueInputObjectSchema } from './objects/TokenWhereUniqueInput.schema';
import { TokenCountAggregateInputObjectSchema as TokenCountAggregateInputObjectSchema } from './objects/TokenCountAggregateInput.schema';

export const TokenCountSchema: z.ZodType<Prisma.TokenCountArgs> = z.object({ orderBy: z.union([TokenOrderByWithRelationInputObjectSchema, TokenOrderByWithRelationInputObjectSchema.array()]).optional(), where: TokenWhereInputObjectSchema.optional(), cursor: TokenWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), select: z.union([ z.literal(true), TokenCountAggregateInputObjectSchema ]).optional() }).strict() as unknown as z.ZodType<Prisma.TokenCountArgs>;

export const TokenCountZodSchema = z.object({ orderBy: z.union([TokenOrderByWithRelationInputObjectSchema, TokenOrderByWithRelationInputObjectSchema.array()]).optional(), where: TokenWhereInputObjectSchema.optional(), cursor: TokenWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), select: z.union([ z.literal(true), TokenCountAggregateInputObjectSchema ]).optional() }).strict();