import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { PlatformRoleSchema } from '../enums/PlatformRole.schema'

const nestedenumplatformrolefilterSchema = z.object({
  equals: PlatformRoleSchema.optional(),
  in: PlatformRoleSchema.array().optional(),
  notIn: PlatformRoleSchema.array().optional(),
  not: z.union([PlatformRoleSchema, z.lazy(() => NestedEnumPlatformRoleFilterObjectSchema)]).optional()
}).strict();
export const NestedEnumPlatformRoleFilterObjectSchema: z.ZodType<Prisma.NestedEnumPlatformRoleFilter> = nestedenumplatformrolefilterSchema as unknown as z.ZodType<Prisma.NestedEnumPlatformRoleFilter>;
export const NestedEnumPlatformRoleFilterObjectZodSchema = nestedenumplatformrolefilterSchema;
