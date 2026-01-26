import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { TokenOwnerModelSchema } from '../enums/TokenOwnerModel.schema'

const makeSchema = () => z.object({
  set: TokenOwnerModelSchema.optional()
}).strict();
export const EnumTokenOwnerModelFieldUpdateOperationsInputObjectSchema: z.ZodType<Prisma.EnumTokenOwnerModelFieldUpdateOperationsInput> = makeSchema() as unknown as z.ZodType<Prisma.EnumTokenOwnerModelFieldUpdateOperationsInput>;
export const EnumTokenOwnerModelFieldUpdateOperationsInputObjectZodSchema = makeSchema();
