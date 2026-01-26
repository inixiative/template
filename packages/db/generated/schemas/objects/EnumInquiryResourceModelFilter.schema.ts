import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryResourceModelSchema } from '../enums/InquiryResourceModel.schema';
import { NestedEnumInquiryResourceModelFilterObjectSchema as NestedEnumInquiryResourceModelFilterObjectSchema } from './NestedEnumInquiryResourceModelFilter.schema'

const makeSchema = () => z.object({
  equals: InquiryResourceModelSchema.optional(),
  in: InquiryResourceModelSchema.array().optional(),
  notIn: InquiryResourceModelSchema.array().optional(),
  not: z.union([InquiryResourceModelSchema, z.lazy(() => NestedEnumInquiryResourceModelFilterObjectSchema)]).optional()
}).strict();
export const EnumInquiryResourceModelFilterObjectSchema: z.ZodType<Prisma.EnumInquiryResourceModelFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumInquiryResourceModelFilter>;
export const EnumInquiryResourceModelFilterObjectZodSchema = makeSchema();
