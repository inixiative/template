import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryTypeSchema } from '../enums/InquiryType.schema';
import { NestedEnumInquiryTypeWithAggregatesFilterObjectSchema as NestedEnumInquiryTypeWithAggregatesFilterObjectSchema } from './NestedEnumInquiryTypeWithAggregatesFilter.schema';
import { NestedIntFilterObjectSchema as NestedIntFilterObjectSchema } from './NestedIntFilter.schema';
import { NestedEnumInquiryTypeFilterObjectSchema as NestedEnumInquiryTypeFilterObjectSchema } from './NestedEnumInquiryTypeFilter.schema'

const makeSchema = () => z.object({
  equals: InquiryTypeSchema.optional(),
  in: InquiryTypeSchema.array().optional(),
  notIn: InquiryTypeSchema.array().optional(),
  not: z.union([InquiryTypeSchema, z.lazy(() => NestedEnumInquiryTypeWithAggregatesFilterObjectSchema)]).optional(),
  _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
  _min: z.lazy(() => NestedEnumInquiryTypeFilterObjectSchema).optional(),
  _max: z.lazy(() => NestedEnumInquiryTypeFilterObjectSchema).optional()
}).strict();
export const EnumInquiryTypeWithAggregatesFilterObjectSchema: z.ZodType<Prisma.EnumInquiryTypeWithAggregatesFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumInquiryTypeWithAggregatesFilter>;
export const EnumInquiryTypeWithAggregatesFilterObjectZodSchema = makeSchema();
