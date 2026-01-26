import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { PlatformRoleSchema } from '../enums/PlatformRole.schema';
import { NestedIntFilterObjectSchema as NestedIntFilterObjectSchema } from './NestedIntFilter.schema';
import { NestedEnumPlatformRoleFilterObjectSchema as NestedEnumPlatformRoleFilterObjectSchema } from './NestedEnumPlatformRoleFilter.schema'

const nestedenumplatformrolewithaggregatesfilterSchema = z.object({
  equals: PlatformRoleSchema.optional(),
  in: PlatformRoleSchema.array().optional(),
  notIn: PlatformRoleSchema.array().optional(),
  not: z.union([PlatformRoleSchema, z.lazy(() => NestedEnumPlatformRoleWithAggregatesFilterObjectSchema)]).optional(),
  _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
  _min: z.lazy(() => NestedEnumPlatformRoleFilterObjectSchema).optional(),
  _max: z.lazy(() => NestedEnumPlatformRoleFilterObjectSchema).optional()
}).strict();
export const NestedEnumPlatformRoleWithAggregatesFilterObjectSchema: z.ZodType<Prisma.NestedEnumPlatformRoleWithAggregatesFilter> = nestedenumplatformrolewithaggregatesfilterSchema as unknown as z.ZodType<Prisma.NestedEnumPlatformRoleWithAggregatesFilter>;
export const NestedEnumPlatformRoleWithAggregatesFilterObjectZodSchema = nestedenumplatformrolewithaggregatesfilterSchema;
