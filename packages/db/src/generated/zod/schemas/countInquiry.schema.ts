import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { InquiryOrderByWithRelationInputObjectSchema as InquiryOrderByWithRelationInputObjectSchema } from './objects/InquiryOrderByWithRelationInput.schema';
import { InquiryWhereInputObjectSchema as InquiryWhereInputObjectSchema } from './objects/InquiryWhereInput.schema';
import { InquiryWhereUniqueInputObjectSchema as InquiryWhereUniqueInputObjectSchema } from './objects/InquiryWhereUniqueInput.schema';
import { InquiryCountAggregateInputObjectSchema as InquiryCountAggregateInputObjectSchema } from './objects/InquiryCountAggregateInput.schema';

export const InquiryCountSchema: z.ZodType<Prisma.InquiryCountArgs> = z.object({ orderBy: z.union([InquiryOrderByWithRelationInputObjectSchema, InquiryOrderByWithRelationInputObjectSchema.array()]).optional(), where: InquiryWhereInputObjectSchema.optional(), cursor: InquiryWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), select: z.union([ z.literal(true), InquiryCountAggregateInputObjectSchema ]).optional() }).strict() as unknown as z.ZodType<Prisma.InquiryCountArgs>;

export const InquiryCountZodSchema = z.object({ orderBy: z.union([InquiryOrderByWithRelationInputObjectSchema, InquiryOrderByWithRelationInputObjectSchema.array()]).optional(), where: InquiryWhereInputObjectSchema.optional(), cursor: InquiryWhereUniqueInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), select: z.union([ z.literal(true), InquiryCountAggregateInputObjectSchema ]).optional() }).strict();