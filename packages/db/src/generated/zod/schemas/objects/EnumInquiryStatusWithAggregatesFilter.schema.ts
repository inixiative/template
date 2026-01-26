import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquiryStatusSchema } from '../enums/InquiryStatus.schema';
import { NestedEnumInquiryStatusWithAggregatesFilterObjectSchema as NestedEnumInquiryStatusWithAggregatesFilterObjectSchema } from './NestedEnumInquiryStatusWithAggregatesFilter.schema';
import { NestedIntFilterObjectSchema as NestedIntFilterObjectSchema } from './NestedIntFilter.schema';
import { NestedEnumInquiryStatusFilterObjectSchema as NestedEnumInquiryStatusFilterObjectSchema } from './NestedEnumInquiryStatusFilter.schema'

const makeSchema = () => z.object({
  equals: InquiryStatusSchema.optional(),
  in: InquiryStatusSchema.array().optional(),
  notIn: InquiryStatusSchema.array().optional(),
  not: z.union([InquiryStatusSchema, z.lazy(() => NestedEnumInquiryStatusWithAggregatesFilterObjectSchema)]).optional(),
  _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
  _min: z.lazy(() => NestedEnumInquiryStatusFilterObjectSchema).optional(),
  _max: z.lazy(() => NestedEnumInquiryStatusFilterObjectSchema).optional()
}).strict();
export const EnumInquiryStatusWithAggregatesFilterObjectSchema: z.ZodType<Prisma.EnumInquiryStatusWithAggregatesFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumInquiryStatusWithAggregatesFilter>;
export const EnumInquiryStatusWithAggregatesFilterObjectZodSchema = makeSchema();
