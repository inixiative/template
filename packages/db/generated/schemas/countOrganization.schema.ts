import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { OrganizationOrderByWithRelationInputObjectSchema as OrganizationOrderByWithRelationInputObjectSchema } from './objects/OrganizationOrderByWithRelationInput.schema';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './objects/OrganizationWhereInput.schema';
import { OrganizationWhereUniqueInputObjectSchema as OrganizationWhereUniqueInputObjectSchema } from './objects/OrganizationWhereUniqueInput.schema';
import { OrganizationCountAggregateInputObjectSchema as OrganizationCountAggregateInputObjectSchema } from './objects/OrganizationCountAggregateInput.schema';

export const OrganizationCountSchema: z.ZodType<Prisma.OrganizationCountArgs> = z.object({ orderBy: z.union([OrganizationOrderByWithRelationInputObjectSchema, OrganizationOrderByWithRelationInputObjectSchema.array()]).optional(), where: OrganizationWhereInputObjectSchema.optional(), cursor: OrganizationWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), select: z.union([ z.literal(true), OrganizationCountAggregateInputObjectSchema ]).optional() }).strict() as unknown as z.ZodType<Prisma.OrganizationCountArgs>;

export const OrganizationCountZodSchema = z.object({ orderBy: z.union([OrganizationOrderByWithRelationInputObjectSchema, OrganizationOrderByWithRelationInputObjectSchema.array()]).optional(), where: OrganizationWhereInputObjectSchema.optional(), cursor: OrganizationWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), select: z.union([ z.literal(true), OrganizationCountAggregateInputObjectSchema ]).optional() }).strict();