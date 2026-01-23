import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { KycStatusSchema } from '../enums/KycStatus.schema'

const makeSchema = () => z.object({
  set: KycStatusSchema.optional()
}).strict();
export const EnumKycStatusFieldUpdateOperationsInputObjectSchema: z.ZodType<Prisma.EnumKycStatusFieldUpdateOperationsInput> = makeSchema() as unknown as z.ZodType<Prisma.EnumKycStatusFieldUpdateOperationsInput>;
export const EnumKycStatusFieldUpdateOperationsInputObjectZodSchema = makeSchema();
