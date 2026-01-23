import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { WalletWhereInputObjectSchema as WalletWhereInputObjectSchema } from './objects/WalletWhereInput.schema';
import { WalletOrderByWithAggregationInputObjectSchema as WalletOrderByWithAggregationInputObjectSchema } from './objects/WalletOrderByWithAggregationInput.schema';
import { WalletScalarWhereWithAggregatesInputObjectSchema as WalletScalarWhereWithAggregatesInputObjectSchema } from './objects/WalletScalarWhereWithAggregatesInput.schema';
import { WalletScalarFieldEnumSchema } from './enums/WalletScalarFieldEnum.schema';
import { WalletCountAggregateInputObjectSchema as WalletCountAggregateInputObjectSchema } from './objects/WalletCountAggregateInput.schema';
import { WalletMinAggregateInputObjectSchema as WalletMinAggregateInputObjectSchema } from './objects/WalletMinAggregateInput.schema';
import { WalletMaxAggregateInputObjectSchema as WalletMaxAggregateInputObjectSchema } from './objects/WalletMaxAggregateInput.schema';

export const WalletGroupBySchema: z.ZodType<Prisma.WalletGroupByArgs> = z.object({ where: WalletWhereInputObjectSchema.optional(), orderBy: z.union([WalletOrderByWithAggregationInputObjectSchema, WalletOrderByWithAggregationInputObjectSchema.array()]).optional(), having: WalletScalarWhereWithAggregatesInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), by: z.array(WalletScalarFieldEnumSchema), _count: z.union([ z.literal(true), WalletCountAggregateInputObjectSchema ]).optional(), _min: WalletMinAggregateInputObjectSchema.optional(), _max: WalletMaxAggregateInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.WalletGroupByArgs>;

export const WalletGroupByZodSchema = z.object({ where: WalletWhereInputObjectSchema.optional(), orderBy: z.union([WalletOrderByWithAggregationInputObjectSchema, WalletOrderByWithAggregationInputObjectSchema.array()]).optional(), having: WalletScalarWhereWithAggregatesInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), by: z.array(WalletScalarFieldEnumSchema), _count: z.union([ z.literal(true), WalletCountAggregateInputObjectSchema ]).optional(), _min: WalletMinAggregateInputObjectSchema.optional(), _max: WalletMaxAggregateInputObjectSchema.optional() }).strict();