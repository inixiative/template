import type { Prisma } from '../../src/generated/client/client';
import * as z from 'zod';
import { InquiryOrderByWithRelationInputObjectSchema as InquiryOrderByWithRelationInputObjectSchema } from './objects/InquiryOrderByWithRelationInput.schema';
import { InquiryWhereInputObjectSchema as InquiryWhereInputObjectSchema } from './objects/InquiryWhereInput.schema';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './objects/InquiryWhereUniqueInput.schema';
import { InquiryCountAggregateInputObjectSchema as InquiryCountAggregateInputObjectSchema } from './objects/InquiryCountAggregateInput.schema';
import { InquiryMinAggregateInputObjectSchema as InquiryMinAggregateInputObjectSchema } from './objects/InquiryMinAggregateInput.schema';
import { InquiryMaxAggregateInputObjectSchema as InquiryMaxAggregateInputObjectSchema } from './objects/InquiryMaxAggregateInput.schema';

export const InquiryAggregateSchema: z.ZodType<Prisma.InquiryAggregateArgs> = z.object({ orderBy: z.union([InquiryOrderByWithRelationInputObjectSchema, InquiryOrderByWithRelationInputObjectSchema.array()]).optional(), where: InquiryWhereInputObjectSchema.optional(), cursor: InquiryWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), _count: z.union([ z.literal(true), InquiryCountAggregateInputObjectSchema ]).optional(), _min: InquiryMinAggregateInputObjectSchema.optional(), _max: InquiryMaxAggregateInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.InquiryAggregateArgs>;

export const InquiryAggregateZodSchema = z.object({ orderBy: z.union([InquiryOrderByWithRelationInputObjectSchema, InquiryOrderByWithRelationInputObjectSchema.array()]).optional(), where: InquiryWhereInputObjectSchema.optional(), cursor: InquiryWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), _count: z.union([ z.literal(true), InquiryCountAggregateInputObjectSchema ]).optional(), _min: InquiryMinAggregateInputObjectSchema.optional(), _max: InquiryMaxAggregateInputObjectSchema.optional() }).strict();