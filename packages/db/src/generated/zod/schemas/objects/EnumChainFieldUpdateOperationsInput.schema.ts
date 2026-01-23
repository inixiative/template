import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { ChainSchema } from '../enums/Chain.schema'

const makeSchema = () => z.object({
  set: ChainSchema.optional()
}).strict();
export const EnumChainFieldUpdateOperationsInputObjectSchema: z.ZodType<Prisma.EnumChainFieldUpdateOperationsInput> = makeSchema() as unknown as z.ZodType<Prisma.EnumChainFieldUpdateOperationsInput>;
export const EnumChainFieldUpdateOperationsInputObjectZodSchema = makeSchema();
