import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationRoleSchema } from '../enums/OrganizationRole.schema';
import { NestedEnumOrganizationRoleWithAggregatesFilterObjectSchema as NestedEnumOrganizationRoleWithAggregatesFilterObjectSchema } from './NestedEnumOrganizationRoleWithAggregatesFilter.schema';
import { NestedIntFilterObjectSchema as NestedIntFilterObjectSchema } from './NestedIntFilter.schema';
import { NestedEnumOrganizationRoleFilterObjectSchema as NestedEnumOrganizationRoleFilterObjectSchema } from './NestedEnumOrganizationRoleFilter.schema'

const makeSchema = () => z.object({
  equals: OrganizationRoleSchema.optional(),
  in: OrganizationRoleSchema.array().optional(),
  notIn: OrganizationRoleSchema.array().optional(),
  not: z.union([OrganizationRoleSchema, z.lazy(() => NestedEnumOrganizationRoleWithAggregatesFilterObjectSchema)]).optional(),
  _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
  _min: z.lazy(() => NestedEnumOrganizationRoleFilterObjectSchema).optional(),
  _max: z.lazy(() => NestedEnumOrganizationRoleFilterObjectSchema).optional()
}).strict();
export const EnumOrganizationRoleWithAggregatesFilterObjectSchema: z.ZodType<Prisma.EnumOrganizationRoleWithAggregatesFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumOrganizationRoleWithAggregatesFilter>;
export const EnumOrganizationRoleWithAggregatesFilterObjectZodSchema = makeSchema();
