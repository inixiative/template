import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationRoleSchema } from '../enums/OrganizationRole.schema'

const nestedenumorganizationrolefilterSchema = z.object({
  equals: OrganizationRoleSchema.optional(),
  in: OrganizationRoleSchema.array().optional(),
  notIn: OrganizationRoleSchema.array().optional(),
  not: z.union([OrganizationRoleSchema, z.lazy(() => NestedEnumOrganizationRoleFilterObjectSchema)]).optional()
}).strict();
export const NestedEnumOrganizationRoleFilterObjectSchema: z.ZodType<Prisma.NestedEnumOrganizationRoleFilter> = nestedenumorganizationrolefilterSchema as unknown as z.ZodType<Prisma.NestedEnumOrganizationRoleFilter>;
export const NestedEnumOrganizationRoleFilterObjectZodSchema = nestedenumorganizationrolefilterSchema;
