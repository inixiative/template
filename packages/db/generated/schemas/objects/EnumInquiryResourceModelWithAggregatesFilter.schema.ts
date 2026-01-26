import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryResourceModelSchema } from '../enums/InquiryResourceModel.schema';
import { NestedEnumInquiryResourceModelWithAggregatesFilterObjectSchema as NestedEnumInquiryResourceModelWithAggregatesFilterObjectSchema } from './NestedEnumInquiryResourceModelWithAggregatesFilter.schema';
import { NestedIntFilterObjectSchema as NestedIntFilterObjectSchema } from './NestedIntFilter.schema';
import { NestedEnumInquiryResourceModelFilterObjectSchema as NestedEnumInquiryResourceModelFilterObjectSchema } from './NestedEnumInquiryResourceModelFilter.schema'

const makeSchema = () => z.object({
  equals: InquiryResourceModelSchema.optional(),
  in: InquiryResourceModelSchema.array().optional(),
  notIn: InquiryResourceModelSchema.array().optional(),
  not: z.union([InquiryResourceModelSchema, z.lazy(() => NestedEnumInquiryResourceModelWithAggregatesFilterObjectSchema)]).optional(),
  _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
  _min: z.lazy(() => NestedEnumInquiryResourceModelFilterObjectSchema).optional(),
  _max: z.lazy(() => NestedEnumInquiryResourceModelFilterObjectSchema).optional()
}).strict();
export const EnumInquiryResourceModelWithAggregatesFilterObjectSchema: z.ZodType<Prisma.EnumInquiryResourceModelWithAggregatesFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumInquiryResourceModelWithAggregatesFilter>;
export const EnumInquiryResourceModelWithAggregatesFilterObjectZodSchema = makeSchema();
