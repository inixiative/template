import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { PlatformRoleSchema } from '../enums/PlatformRole.schema';
import { NestedEnumPlatformRoleFilterObjectSchema as NestedEnumPlatformRoleFilterObjectSchema } from './NestedEnumPlatformRoleFilter.schema'

const makeSchema = () => z.object({
  equals: PlatformRoleSchema.optional(),
  in: PlatformRoleSchema.array().optional(),
  notIn: PlatformRoleSchema.array().optional(),
  not: z.union([PlatformRoleSchema, z.lazy(() => NestedEnumPlatformRoleFilterObjectSchema)]).optional()
}).strict();
export const EnumPlatformRoleFilterObjectSchema: z.ZodType<Prisma.EnumPlatformRoleFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumPlatformRoleFilter>;
export const EnumPlatformRoleFilterObjectZodSchema = makeSchema();
