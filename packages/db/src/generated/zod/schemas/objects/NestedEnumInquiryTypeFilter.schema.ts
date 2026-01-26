import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquiryTypeSchema } from '../enums/InquiryType.schema'

const nestedenuminquirytypefilterSchema = z.object({
  equals: InquiryTypeSchema.optional(),
  in: InquiryTypeSchema.array().optional(),
  notIn: InquiryTypeSchema.array().optional(),
  not: z.union([InquiryTypeSchema, z.lazy(() => NestedEnumInquiryTypeFilterObjectSchema)]).optional()
}).strict();
export const NestedEnumInquiryTypeFilterObjectSchema: z.ZodType<Prisma.NestedEnumInquiryTypeFilter> = nestedenuminquirytypefilterSchema as unknown as z.ZodType<Prisma.NestedEnumInquiryTypeFilter>;
export const NestedEnumInquiryTypeFilterObjectZodSchema = nestedenuminquirytypefilterSchema;
