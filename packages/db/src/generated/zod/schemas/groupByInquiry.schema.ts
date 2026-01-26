import type { Prisma } from '../../client/client';
import * as z from 'zod';
import { InquiryWhereInputObjectSchema as InquiryWhereInputObjectSchema } from './objects/InquiryWhereInput.schema';
import { InquiryOrderByWithAggregationInputObjectSchema as InquiryOrderByWithAggregationInputObjectSchema } from './objects/InquiryOrderByWithAggregationInput.schema';
import { InquiryScalarWhereWithAggregatesInputObjectSchema as InquiryScalarWhereWithAggregatesInputObjectSchema } from './objects/InquiryScalarWhereWithAggregatesInput.schema';
import { InquiryScalarFieldEnumSchema } from './enums/InquiryScalarFieldEnum.schema';
import { InquiryCountAggregateInputObjectSchema as InquiryCountAggregateInputObjectSchema } from './objects/InquiryCountAggregateInput.schema';
import { InquiryMinAggregateInputObjectSchema as InquiryMinAggregateInputObjectSchema } from './objects/InquiryMinAggregateInput.schema';
import { InquiryMaxAggregateInputObjectSchema as InquiryMaxAggregateInputObjectSchema } from './objects/InquiryMaxAggregateInput.schema';

export const InquiryGroupBySchema: z.ZodType<Prisma.InquiryGroupByArgs> = z.object({ where: InquiryWhereInputObjectSchema.optional(), orderBy: z.union([InquiryOrderByWithAggregationInputObjectSchema, InquiryOrderByWithAggregationInputObjectSchema.array()]).optional(), having: InquiryScalarWhereWithAggregatesInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), by: z.array(InquiryScalarFieldEnumSchema), _count: z.union([ z.literal(true), InquiryCountAggregateInputObjectSchema ]).optional(), _min: InquiryMinAggregateInputObjectSchema.optional(), _max: InquiryMaxAggregateInputObjectSchema.optional() }).strict() as unknown as z.ZodType<Prisma.InquiryGroupByArgs>;

export const InquiryGroupByZodSchema = z.object({ where: InquiryWhereInputObjectSchema.optional(), orderBy: z.union([InquiryOrderByWithAggregationInputObjectSchema, InquiryOrderByWithAggregationInputObjectSchema.array()]).optional(), having: InquiryScalarWhereWithAggregatesInputObjectSchema.optional(), take: z.number().optional(), skip: z.number().optional(), by: z.array(InquiryScalarFieldEnumSchema), _count: z.union([ z.literal(true), InquiryCountAggregateInputObjectSchema ]).optional(), _min: InquiryMinAggregateInputObjectSchema.optional(), _max: InquiryMaxAggregateInputObjectSchema.optional() }).strict();