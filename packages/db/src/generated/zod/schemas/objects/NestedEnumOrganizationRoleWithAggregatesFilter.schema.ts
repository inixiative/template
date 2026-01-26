import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationRoleSchema } from '../enums/OrganizationRole.schema';
import { NestedIntFilterObjectSchema as NestedIntFilterObjectSchema } from './NestedIntFilter.schema';
import { NestedEnumOrganizationRoleFilterObjectSchema as NestedEnumOrganizationRoleFilterObjectSchema } from './NestedEnumOrganizationRoleFilter.schema'

const nestedenumorganizationrolewithaggregatesfilterSchema = z.object({
  equals: OrganizationRoleSchema.optional(),
  in: OrganizationRoleSchema.array().optional(),
  notIn: OrganizationRoleSchema.array().optional(),
  not: z.union([OrganizationRoleSchema, z.lazy(() => NestedEnumOrganizationRoleWithAggregatesFilterObjectSchema)]).optional(),
  _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
  _min: z.lazy(() => NestedEnumOrganizationRoleFilterObjectSchema).optional(),
  _max: z.lazy(() => NestedEnumOrganizationRoleFilterObjectSchema).optional()
}).strict();
export const NestedEnumOrganizationRoleWithAggregatesFilterObjectSchema: z.ZodType<Prisma.NestedEnumOrganizationRoleWithAggregatesFilter> = nestedenumorganizationrolewithaggregatesfilterSchema as unknown as z.ZodType<Prisma.NestedEnumOrganizationRoleWithAggregatesFilter>;
export const NestedEnumOrganizationRoleWithAggregatesFilterObjectZodSchema = nestedenumorganizationrolewithaggregatesfilterSchema;
