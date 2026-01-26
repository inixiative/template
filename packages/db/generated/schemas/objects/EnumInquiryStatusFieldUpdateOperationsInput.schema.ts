import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { InquiryStatusSchema } from '../enums/InquiryStatus.schema'

const makeSchema = () => z.object({
  set: InquiryStatusSchema.optional()
}).strict();
export const EnumInquiryStatusFieldUpdateOperationsInputObjectSchema: z.ZodType<Prisma.EnumInquiryStatusFieldUpdateOperationsInput> = makeSchema() as unknown as z.ZodType<Prisma.EnumInquiryStatusFieldUpdateOperationsInput>;
export const EnumInquiryStatusFieldUpdateOperationsInputObjectZodSchema = makeSchema();
