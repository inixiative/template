import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringFilterObjectSchema as StringFilterObjectSchema } from './StringFilter.schema';
import { EnumOrganizationRoleFilterObjectSchema as EnumOrganizationRoleFilterObjectSchema } from './EnumOrganizationRoleFilter.schema';
import { OrganizationRoleSchema } from '../enums/OrganizationRole.schema';
import { JsonNullableFilterObjectSchema as JsonNullableFilterObjectSchema } from './JsonNullableFilter.schema';
import { DateTimeFilterObjectSchema as DateTimeFilterObjectSchema } from './DateTimeFilter.schema'

const organizationuserscalarwhereinputSchema = z.object({
  AND: z.union([z.lazy(() => OrganizationUserScalarWhereInputObjectSchema), z.lazy(() => OrganizationUserScalarWhereInputObjectSchema).array()]).optional(),
  OR: z.lazy(() => OrganizationUserScalarWhereInputObjectSchema).array().optional(),
  NOT: z.union([z.lazy(() => OrganizationUserScalarWhereInputObjectSchema), z.lazy(() => OrganizationUserScalarWhereInputObjectSchema).array()]).optional(),
  id: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  organizationId: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  userId: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  role: z.union([z.lazy(() => EnumOrganizationRoleFilterObjectSchema), OrganizationRoleSchema]).optional(),
  entitlements: z.lazy(() => JsonNullableFilterObjectSchema).optional(),
  createdAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  updatedAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional()
}).strict();
export const OrganizationUserScalarWhereInputObjectSchema: z.ZodType<Prisma.OrganizationUserScalarWhereInput> = organizationuserscalarwhereinputSchema as unknown as z.ZodType<Prisma.OrganizationUserScalarWhereInput>;
export const OrganizationUserScalarWhereInputObjectZodSchema = organizationuserscalarwhereinputSchema;
