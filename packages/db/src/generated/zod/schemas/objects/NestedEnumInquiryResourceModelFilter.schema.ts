import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquiryResourceModelSchema } from '../enums/InquiryResourceModel.schema'

const nestedenuminquiryresourcemodelfilterSchema = z.object({
  equals: InquiryResourceModelSchema.optional(),
  in: InquiryResourceModelSchema.array().optional(),
  notIn: InquiryResourceModelSchema.array().optional(),
  not: z.union([InquiryResourceModelSchema, z.lazy(() => NestedEnumInquiryResourceModelFilterObjectSchema)]).optional()
}).strict();
export const NestedEnumInquiryResourceModelFilterObjectSchema: z.ZodType<Prisma.NestedEnumInquiryResourceModelFilter> = nestedenuminquiryresourcemodelfilterSchema as unknown as z.ZodType<Prisma.NestedEnumInquiryResourceModelFilter>;
export const NestedEnumInquiryResourceModelFilterObjectZodSchema = nestedenuminquiryresourcemodelfilterSchema;
