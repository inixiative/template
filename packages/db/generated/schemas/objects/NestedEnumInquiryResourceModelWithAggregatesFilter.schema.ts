import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryResourceModelSchema } from '../enums/InquiryResourceModel.schema';
import { NestedIntFilterObjectSchema as NestedIntFilterObjectSchema } from './NestedIntFilter.schema';
import { NestedEnumInquiryResourceModelFilterObjectSchema as NestedEnumInquiryResourceModelFilterObjectSchema } from './NestedEnumInquiryResourceModelFilter.schema'

const nestedenuminquiryresourcemodelwithaggregatesfilterSchema = z.object({
  equals: InquiryResourceModelSchema.optional(),
  in: InquiryResourceModelSchema.array().optional(),
  notIn: InquiryResourceModelSchema.array().optional(),
  not: z.union([InquiryResourceModelSchema, z.lazy(() => NestedEnumInquiryResourceModelWithAggregatesFilterObjectSchema)]).optional(),
  _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
  _min: z.lazy(() => NestedEnumInquiryResourceModelFilterObjectSchema).optional(),
  _max: z.lazy(() => NestedEnumInquiryResourceModelFilterObjectSchema).optional()
}).strict();
export const NestedEnumInquiryResourceModelWithAggregatesFilterObjectSchema: z.ZodType<Prisma.NestedEnumInquiryResourceModelWithAggregatesFilter> = nestedenuminquiryresourcemodelwithaggregatesfilterSchema as unknown as z.ZodType<Prisma.NestedEnumInquiryResourceModelWithAggregatesFilter>;
export const NestedEnumInquiryResourceModelWithAggregatesFilterObjectZodSchema = nestedenuminquiryresourcemodelwithaggregatesfilterSchema;
