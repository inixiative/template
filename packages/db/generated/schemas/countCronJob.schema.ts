import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { CronJobOrderByWithRelationInputObjectSchema as CronJobOrderByWithRelationInputObjectSchema } from './objects/CronJobOrderByWithRelationInput.schema';
import { CronJobWhereInputObjectSchema as CronJobWhereInputObjectSchema } from './objects/CronJobWhereInput.schema';
import { CronJobWhereUniqueInputObjectSchema as CronJobWhereUniqueInputObjectSchema } from './objects/CronJobWhereUniqueInput.schema';
import { CronJobCountAggregateInputObjectSchema as CronJobCountAggregateInputObjectSchema } from './objects/CronJobCountAggregateInput.schema';

export const CronJobCountSchema: z.ZodType<Prisma.CronJobCountArgs> = z.object({ orderBy: z.union([CronJobOrderByWithRelationInputObjectSchema, CronJobOrderByWithRelationInputObjectSchema.array()]).optional(), where: CronJobWhereInputObjectSchema.optional(), cursor: CronJobWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), select: z.union([ z.literal(true), CronJobCountAggregateInputObjectSchema ]).optional() }).strict() as unknown as z.ZodType<Prisma.CronJobCountArgs>;

export const CronJobCountZodSchema = z.object({ orderBy: z.union([CronJobOrderByWithRelationInputObjectSchema, CronJobOrderByWithRelationInputObjectSchema.array()]).optional(), where: CronJobWhereInputObjectSchema.optional(), cursor: CronJobWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), select: z.union([ z.literal(true), CronJobCountAggregateInputObjectSchema ]).optional() }).strict();