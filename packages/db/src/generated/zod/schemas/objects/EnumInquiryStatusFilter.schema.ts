import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquiryStatusSchema } from '../enums/InquiryStatus.schema';
import { NestedEnumInquiryStatusFilterObjectSchema as NestedEnumInquiryStatusFilterObjectSchema } from './NestedEnumInquiryStatusFilter.schema'

const makeSchema = () => z.object({
  equals: InquiryStatusSchema.optional(),
  in: InquiryStatusSchema.array().optional(),
  notIn: InquiryStatusSchema.array().optional(),
  not: z.union([InquiryStatusSchema, z.lazy(() => NestedEnumInquiryStatusFilterObjectSchema)]).optional()
}).strict();
export const EnumInquiryStatusFilterObjectSchema: z.ZodType<Prisma.EnumInquiryStatusFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumInquiryStatusFilter>;
export const EnumInquiryStatusFilterObjectZodSchema = makeSchema();
