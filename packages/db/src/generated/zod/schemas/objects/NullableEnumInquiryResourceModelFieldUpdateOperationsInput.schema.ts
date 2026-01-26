import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { InquiryResourceModelSchema } from '../enums/InquiryResourceModel.schema'

const makeSchema = () => z.object({
  set: InquiryResourceModelSchema.optional()
}).strict();
export const NullableEnumInquiryResourceModelFieldUpdateOperationsInputObjectSchema: z.ZodType<Prisma.NullableEnumInquiryResourceModelFieldUpdateOperationsInput> = makeSchema() as unknown as z.ZodType<Prisma.NullableEnumInquiryResourceModelFieldUpdateOperationsInput>;
export const NullableEnumInquiryResourceModelFieldUpdateOperationsInputObjectZodSchema = makeSchema();
