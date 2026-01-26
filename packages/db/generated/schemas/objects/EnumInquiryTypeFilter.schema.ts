import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryTypeSchema } from '../enums/InquiryType.schema';
import { NestedEnumInquiryTypeFilterObjectSchema as NestedEnumInquiryTypeFilterObjectSchema } from './NestedEnumInquiryTypeFilter.schema'

const makeSchema = () => z.object({
  equals: InquiryTypeSchema.optional(),
  in: InquiryTypeSchema.array().optional(),
  notIn: InquiryTypeSchema.array().optional(),
  not: z.union([InquiryTypeSchema, z.lazy(() => NestedEnumInquiryTypeFilterObjectSchema)]).optional()
}).strict();
export const EnumInquiryTypeFilterObjectSchema: z.ZodType<Prisma.EnumInquiryTypeFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumInquiryTypeFilter>;
export const EnumInquiryTypeFilterObjectZodSchema = makeSchema();
