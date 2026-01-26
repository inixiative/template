import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryResourceModelSchema } from '../enums/InquiryResourceModel.schema';
import { NestedEnumInquiryResourceModelNullableWithAggregatesFilterObjectSchema as NestedEnumInquiryResourceModelNullableWithAggregatesFilterObjectSchema } from './NestedEnumInquiryResourceModelNullableWithAggregatesFilter.schema';
import { NestedIntNullableFilterObjectSchema as NestedIntNullableFilterObjectSchema } from './NestedIntNullableFilter.schema';
import { NestedEnumInquiryResourceModelNullableFilterObjectSchema as NestedEnumInquiryResourceModelNullableFilterObjectSchema } from './NestedEnumInquiryResourceModelNullableFilter.schema'

const makeSchema = () => z.object({
  equals: InquiryResourceModelSchema.optional().nullable(),
  in: InquiryResourceModelSchema.array().optional().nullable(),
  notIn: InquiryResourceModelSchema.array().optional().nullable(),
  not: z.union([InquiryResourceModelSchema, z.lazy(() => NestedEnumInquiryResourceModelNullableWithAggregatesFilterObjectSchema)]).optional().nullable(),
  _count: z.lazy(() => NestedIntNullableFilterObjectSchema).optional(),
  _min: z.lazy(() => NestedEnumInquiryResourceModelNullableFilterObjectSchema).optional(),
  _max: z.lazy(() => NestedEnumInquiryResourceModelNullableFilterObjectSchema).optional()
}).strict();
export const EnumInquiryResourceModelNullableWithAggregatesFilterObjectSchema: z.ZodType<Prisma.EnumInquiryResourceModelNullableWithAggregatesFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumInquiryResourceModelNullableWithAggregatesFilter>;
export const EnumInquiryResourceModelNullableWithAggregatesFilterObjectZodSchema = makeSchema();
