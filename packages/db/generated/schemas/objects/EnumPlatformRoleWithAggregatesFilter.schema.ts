import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { PlatformRoleSchema } from '../enums/PlatformRole.schema';
import { NestedEnumPlatformRoleWithAggregatesFilterObjectSchema as NestedEnumPlatformRoleWithAggregatesFilterObjectSchema } from './NestedEnumPlatformRoleWithAggregatesFilter.schema';
import { NestedIntFilterObjectSchema as NestedIntFilterObjectSchema } from './NestedIntFilter.schema';
import { NestedEnumPlatformRoleFilterObjectSchema as NestedEnumPlatformRoleFilterObjectSchema } from './NestedEnumPlatformRoleFilter.schema'

const makeSchema = () => z.object({
  equals: PlatformRoleSchema.optional(),
  in: PlatformRoleSchema.array().optional(),
  notIn: PlatformRoleSchema.array().optional(),
  not: z.union([PlatformRoleSchema, z.lazy(() => NestedEnumPlatformRoleWithAggregatesFilterObjectSchema)]).optional(),
  _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
  _min: z.lazy(() => NestedEnumPlatformRoleFilterObjectSchema).optional(),
  _max: z.lazy(() => NestedEnumPlatformRoleFilterObjectSchema).optional()
}).strict();
export const EnumPlatformRoleWithAggregatesFilterObjectSchema: z.ZodType<Prisma.EnumPlatformRoleWithAggregatesFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumPlatformRoleWithAggregatesFilter>;
export const EnumPlatformRoleWithAggregatesFilterObjectZodSchema = makeSchema();
