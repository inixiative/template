import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquiryResourceModelSchema } from '../enums/InquiryResourceModel.schema';
import { NestedEnumInquiryResourceModelNullableFilterObjectSchema as NestedEnumInquiryResourceModelNullableFilterObjectSchema } from './NestedEnumInquiryResourceModelNullableFilter.schema'

const makeSchema = () => z.object({
  equals: InquiryResourceModelSchema.optional().nullable(),
  in: InquiryResourceModelSchema.array().optional().nullable(),
  notIn: InquiryResourceModelSchema.array().optional().nullable(),
  not: z.union([InquiryResourceModelSchema, z.lazy(() => NestedEnumInquiryResourceModelNullableFilterObjectSchema)]).optional().nullable()
}).strict();
export const EnumInquiryResourceModelNullableFilterObjectSchema: z.ZodType<Prisma.EnumInquiryResourceModelNullableFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumInquiryResourceModelNullableFilter>;
export const EnumInquiryResourceModelNullableFilterObjectZodSchema = makeSchema();
