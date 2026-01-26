import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { TokenWhereInputObjectSchema as TokenWhereInputObjectSchema } from './objects/TokenWhereInput.schema';
import { TokenOrderByWithAggregationInputObjectSchema as TokenOrderByWithAggregationInputObjectSchema } from './objects/TokenOrderByWithAggregationInput.schema';
import { TokenScalarWhereWithAggregatesInputObjectSchema as TokenScalarWhereWithAggregatesInputObjectSchema } from './objects/TokenScalarWhereWithAggregatesInput.schema';
import { TokenScalarFieldEnumSchema } from './enums/TokenScalarFieldEnum.schema';
import { TokenCountAggregateInputObjectSchema as TokenCountAggregateInputObjectSchema } from './objects/TokenCountAggregateInput.schema';
import { TokenMinAggregateInputObjectSchema as TokenMinAggregateInputObjectSchema } from './objects/TokenMinAggregateInput.schema';
import { TokenMaxAggregateInputObjectSchema as TokenMaxAggregateInputObjectSchema } from './objects/TokenMaxAggregateInput.schema';

export const TokenGroupBySchema: z.ZodType<Prisma.TokenGroupByArgs> = z.object({ where: TokenWhereInputObjectSchema.optional(), orderBy: z.union([TokenOrderByWithAggregationInputObjectSchema, TokenOrderByWithAggregationInputObjectSchema.array()]).optional(), having: TokenScalarWhereWithAggregatesInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), by: z.array(TokenScalarFieldEnumSchema), _count: z.union([ z.literal(true), TokenCountAggregateInputObjectSchema ]).optional(), _min: TokenMinAggregateInputObjectSchema.optional(), _max: TokenMaxAggregateInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.TokenGroupByArgs>;

export const TokenGroupByZodSchema = z.object({ where: TokenWhereInputObjectSchema.optional(), orderBy: z.union([TokenOrderByWithAggregationInputObjectSchema, TokenOrderByWithAggregationInputObjectSchema.array()]).optional(), having: TokenScalarWhereWithAggregatesInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), by: z.array(TokenScalarFieldEnumSchema), _count: z.union([ z.literal(true), TokenCountAggregateInputObjectSchema ]).optional(), _min: TokenMinAggregateInputObjectSchema.optional(), _max: TokenMaxAggregateInputObjectSchema.optional() }).strict();