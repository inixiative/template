import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationRoleSchema } from '../enums/OrganizationRole.schema'

const makeSchema = () => z.object({
  set: OrganizationRoleSchema.optional()
}).strict();
export const EnumOrganizationRoleFieldUpdateOperationsInputObjectSchema: z.ZodType<Prisma.EnumOrganizationRoleFieldUpdateOperationsInput> = makeSchema() as unknown as z.ZodType<Prisma.EnumOrganizationRoleFieldUpdateOperationsInput>;
export const EnumOrganizationRoleFieldUpdateOperationsInputObjectZodSchema = makeSchema();
