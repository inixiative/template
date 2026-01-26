import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryStatusSchema } from '../enums/InquiryStatus.schema'

const nestedenuminquirystatusfilterSchema = z.object({
  equals: InquiryStatusSchema.optional(),
  in: InquiryStatusSchema.array().optional(),
  notIn: InquiryStatusSchema.array().optional(),
  not: z.union([InquiryStatusSchema, z.lazy(() => NestedEnumInquiryStatusFilterObjectSchema)]).optional()
}).strict();
export const NestedEnumInquiryStatusFilterObjectSchema: z.ZodType<Prisma.NestedEnumInquiryStatusFilter> = nestedenuminquirystatusfilterSchema as unknown as z.ZodType<Prisma.NestedEnumInquiryStatusFilter>;
export const NestedEnumInquiryStatusFilterObjectZodSchema = nestedenuminquirystatusfilterSchema;
