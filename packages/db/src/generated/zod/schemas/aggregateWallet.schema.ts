import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WalletOrderByWithRelationInputObjectSchema as WalletOrderByWithRelationInputObjectSchema } from './objects/WalletOrderByWithRelationInput.schema';
import { WalletWhereInputObjectSchema as WalletWhereInputObjectSchema } from './objects/WalletWhereInput.schema';
import { WalletWhereUniqueInputObjectSchema as WalletWhereUniqueInputObjectSchema } from './objects/WalletWhereUniqueInput.schema';
import { WalletCountAggregateInputObjectSchema as WalletCountAggregateInputObjectSchema } from './objects/WalletCountAggregateInput.schema';
import { WalletMinAggregateInputObjectSchema as WalletMinAggregateInputObjectSchema } from './objects/WalletMinAggregateInput.schema';
import { WalletMaxAggregateInputObjectSchema as WalletMaxAggregateInputObjectSchema } from './objects/WalletMaxAggregateInput.schema';

export const WalletAggregateSchema: z.ZodType<Prisma.WalletAggregateArgs> = z.object({ orderBy: z.union([WalletOrderByWithRelationInputObjectSchema, WalletOrderByWithRelationInputObjectSchema.array()]).optional(), where: WalletWhereInputObjectSchema.optional(), cursor: WalletWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), _count: z.union([ z.literal(true), WalletCountAggregateInputObjectSchema ]).optional(), _min: WalletMinAggregateInputObjectSchema.optional(), _max: WalletMaxAggregateInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.WalletAggregateArgs>;

export const WalletAggregateZodSchema = z.object({ orderBy: z.union([WalletOrderByWithRelationInputObjectSchema, WalletOrderByWithRelationInputObjectSchema.array()]).optional(), where: WalletWhereInputObjectSchema.optional(), cursor: WalletWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), _count: z.union([ z.literal(true), WalletCountAggregateInputObjectSchema ]).optional(), _min: WalletMinAggregateInputObjectSchema.optional(), _max: WalletMaxAggregateInputObjectSchema.optional() }).strict();