import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationRoleSchema } from '../enums/OrganizationRole.schema';
import { NestedEnumOrganizationRoleFilterObjectSchema as NestedEnumOrganizationRoleFilterObjectSchema } from './NestedEnumOrganizationRoleFilter.schema'

const makeSchema = () => z.object({
  equals: OrganizationRoleSchema.optional(),
  in: OrganizationRoleSchema.array().optional(),
  notIn: OrganizationRoleSchema.array().optional(),
  not: z.union([OrganizationRoleSchema, z.lazy(() => NestedEnumOrganizationRoleFilterObjectSchema)]).optional()
}).strict();
export const EnumOrganizationRoleFilterObjectSchema: z.ZodType<Prisma.EnumOrganizationRoleFilter> = makeSchema() as unknown as z.ZodType<Prisma.EnumOrganizationRoleFilter>;
export const EnumOrganizationRoleFilterObjectZodSchema = makeSchema();
