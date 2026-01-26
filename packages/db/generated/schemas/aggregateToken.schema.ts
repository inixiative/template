import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { TokenOrderByWithRelationInputObjectSchema as TokenOrderByWithRelationInputObjectSchema } from './objects/TokenOrderByWithRelationInput.schema';
import { TokenWhereInputObjectSchema as TokenWhereInputObjectSchema } from './objects/TokenWhereInput.schema';
import { TokenWhereUniqueInputObjectSchema as TokenWhereUniqueInputObjectSchema } from './objects/TokenWhereUniqueInput.schema';
import { TokenCountAggregateInputObjectSchema as TokenCountAggregateInputObjectSchema } from './objects/TokenCountAggregateInput.schema';
import { TokenMinAggregateInputObjectSchema as TokenMinAggregateInputObjectSchema } from './objects/TokenMinAggregateInput.schema';
import { TokenMaxAggregateInputObjectSchema as TokenMaxAggregateInputObjectSchema } from './objects/TokenMaxAggregateInput.schema';

export const TokenAggregateSchema: z.ZodType<Prisma.TokenAggregateArgs> = z.object({ orderBy: z.union([TokenOrderByWithRelationInputObjectSchema, TokenOrderByWithRelationInputObjectSchema.array()]).optional(), where: TokenWhereInputObjectSchema.optional(), cursor: TokenWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), _count: z.union([ z.literal(true), TokenCountAggregateInputObjectSchema ]).optional(), _min: TokenMinAggregateInputObjectSchema.optional(), _max: TokenMaxAggregateInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.TokenAggregateArgs>;

export const TokenAggregateZodSchema = z.object({ orderBy: z.union([TokenOrderByWithRelationInputObjectSchema, TokenOrderByWithRelationInputObjectSchema.array()]).optional(), where: TokenWhereInputObjectSchema.optional(), cursor: TokenWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), _count: z.union([ z.literal(true), TokenCountAggregateInputObjectSchema ]).optional(), _min: TokenMinAggregateInputObjectSchema.optional(), _max: TokenMaxAggregateInputObjectSchema.optional() }).strict();