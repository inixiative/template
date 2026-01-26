import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { PlatformRoleSchema } from '../enums/PlatformRole.schema'

const makeSchema = () => z.object({
  set: PlatformRoleSchema.optional()
}).strict();
export const EnumPlatformRoleFieldUpdateOperationsInputObjectSchema: z.ZodType<Prisma.EnumPlatformRoleFieldUpdateOperationsInput> = makeSchema() as unknown as z.ZodType<Prisma.EnumPlatformRoleFieldUpdateOperationsInput>;
export const EnumPlatformRoleFieldUpdateOperationsInputObjectZodSchema = makeSchema();
