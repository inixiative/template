import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryTypeSchema } from '../enums/InquiryType.schema'

const makeSchema = () => z.object({
  set: InquiryTypeSchema.optional()
}).strict();
export const EnumInquiryTypeFieldUpdateOperationsInputObjectSchema: z.ZodType<Prisma.EnumInquiryTypeFieldUpdateOperationsInput> = makeSchema() as unknown as z.ZodType<Prisma.EnumInquiryTypeFieldUpdateOperationsInput>;
export const EnumInquiryTypeFieldUpdateOperationsInputObjectZodSchema = makeSchema();
