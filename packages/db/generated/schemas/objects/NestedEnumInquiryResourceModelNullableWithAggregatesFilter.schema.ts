import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryResourceModelSchema } from '../enums/InquiryResourceModel.schema';
import { NestedIntNullableFilterObjectSchema as NestedIntNullableFilterObjectSchema } from './NestedIntNullableFilter.schema';
import { NestedEnumInquiryResourceModelNullableFilterObjectSchema as NestedEnumInquiryResourceModelNullableFilterObjectSchema } from './NestedEnumInquiryResourceModelNullableFilter.schema'

const nestedenuminquiryresourcemodelnullablewithaggregatesfilterSchema = z.object({
  equals: InquiryResourceModelSchema.optional().nullable(),
  in: InquiryResourceModelSchema.array().optional().nullable(),
  notIn: InquiryResourceModelSchema.array().optional().nullable(),
  not: z.union([InquiryResourceModelSchema, z.lazy(() => NestedEnumInquiryResourceModelNullableWithAggregatesFilterObjectSchema)]).optional().nullable(),
  _count: z.lazy(() => NestedIntNullableFilterObjectSchema).optional(),
  _min: z.lazy(() => NestedEnumInquiryResourceModelNullableFilterObjectSchema).optional(),
  _max: z.lazy(() => NestedEnumInquiryResourceModelNullableFilterObjectSchema).optional()
}).strict();
export const NestedEnumInquiryResourceModelNullableWithAggregatesFilterObjectSchema: z.ZodType<Prisma.NestedEnumInquiryResourceModelNullableWithAggregatesFilter> = nestedenuminquiryresourcemodelnullablewithaggregatesfilterSchema as unknown as z.ZodType<Prisma.NestedEnumInquiryResourceModelNullableWithAggregatesFilter>;
export const NestedEnumInquiryResourceModelNullableWithAggregatesFilterObjectZodSchema = nestedenuminquiryresourcemodelnullablewithaggregatesfilterSchema;
