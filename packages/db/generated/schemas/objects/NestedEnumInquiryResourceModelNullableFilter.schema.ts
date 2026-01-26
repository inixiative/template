import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryResourceModelSchema } from '../enums/InquiryResourceModel.schema'

const nestedenuminquiryresourcemodelnullablefilterSchema = z.object({
  equals: InquiryResourceModelSchema.optional().nullable(),
  in: InquiryResourceModelSchema.array().optional().nullable(),
  notIn: InquiryResourceModelSchema.array().optional().nullable(),
  not: z.union([InquiryResourceModelSchema, z.lazy(() => NestedEnumInquiryResourceModelNullableFilterObjectSchema)]).optional().nullable()
}).strict();
export const NestedEnumInquiryResourceModelNullableFilterObjectSchema: z.ZodType<Prisma.NestedEnumInquiryResourceModelNullableFilter> = nestedenuminquiryresourcemodelnullablefilterSchema as unknown as z.ZodType<Prisma.NestedEnumInquiryResourceModelNullableFilter>;
export const NestedEnumInquiryResourceModelNullableFilterObjectZodSchema = nestedenuminquiryresourcemodelnullablefilterSchema;
