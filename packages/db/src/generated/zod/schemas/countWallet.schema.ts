import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WalletOrderByWithRelationInputObjectSchema as WalletOrderByWithRelationInputObjectSchema } from './objects/WalletOrderByWithRelationInput.schema';
import { WalletWhereInputObjectSchema as WalletWhereInputObjectSchema } from './objects/WalletWhereInput.schema';
import { WalletWhereUniqueInputObjectSchema as WalletWhereUniqueInputObjectSchema } from './objects/WalletWhereUniqueInput.schema';
import { WalletCountAggregateInputObjectSchema as WalletCountAggregateInputObjectSchema } from './objects/WalletCountAggregateInput.schema';

export const WalletCountSchema: z.ZodType<Prisma.WalletCountArgs> = z.object({ orderBy: z.union([WalletOrderByWithRelationInputObjectSchema, WalletOrderByWithRelationInputObjectSchema.array()]).optional(), where: WalletWhereInputObjectSchema.optional(), cursor: WalletWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), select: z.union([ z.literal(true), WalletCountAggregateInputObjectSchema ]).optional() }).strict() as unknown as z.ZodType<Prisma.WalletCountArgs>;

export const WalletCountZodSchema = z.object({ orderBy: z.union([WalletOrderByWithRelationInputObjectSchema, WalletOrderByWithRelationInputObjectSchema.array()]).optional(), where: WalletWhereInputObjectSchema.optional(), cursor: WalletWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), select: z.union([ z.literal(true), WalletCountAggregateInputObjectSchema ]).optional() }).strict();