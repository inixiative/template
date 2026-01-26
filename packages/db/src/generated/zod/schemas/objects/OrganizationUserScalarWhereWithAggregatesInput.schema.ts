import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringWithAggregatesFilterObjectSchema as StringWithAggregatesFilterObjectSchema } from './StringWithAggregatesFilter.schema';
import { EnumOrganizationRoleWithAggregatesFilterObjectSchema as EnumOrganizationRoleWithAggregatesFilterObjectSchema } from './EnumOrganizationRoleWithAggregatesFilter.schema';
import { OrganizationRoleSchema } from '../enums/OrganizationRole.schema';
import { JsonNullableWithAggregatesFilterObjectSchema as JsonNullableWithAggregatesFilterObjectSchema } from './JsonNullableWithAggregatesFilter.schema';
import { DateTimeWithAggregatesFilterObjectSchema as DateTimeWithAggregatesFilterObjectSchema } from './DateTimeWithAggregatesFilter.schema'

const organizationuserscalarwherewithaggregatesinputSchema = z.object({
  AND: z.union([z.lazy(() => OrganizationUserScalarWhereWithAggregatesInputObjectSchema), z.lazy(() => OrganizationUserScalarWhereWithAggregatesInputObjectSchema).array()]).optional(),
  OR: z.lazy(() => OrganizationUserScalarWhereWithAggregatesInputObjectSchema).array().optional(),
  NOT: z.union([z.lazy(() => OrganizationUserScalarWhereWithAggregatesInputObjectSchema), z.lazy(() => OrganizationUserScalarWhereWithAggregatesInputObjectSchema).array()]).optional(),
  id: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string().max(36)]).optional(),
  organizationId: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string().max(36)]).optional(),
  userId: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string().max(36)]).optional(),
  role: z.union([z.lazy(() => EnumOrganizationRoleWithAggregatesFilterObjectSchema), OrganizationRoleSchema]).optional(),
  entitlements: z.lazy(() => JsonNullableWithAggregatesFilterObjectSchema).optional(),
  createdAt: z.union([z.lazy(() => DateTimeWithAggregatesFilterObjectSchema), z.coerce.date()]).optional(),
  updatedAt: z.union([z.lazy(() => DateTimeWithAggregatesFilterObjectSchema), z.coerce.date()]).optional()
}).strict();
export const OrganizationUserScalarWhereWithAggregatesInputObjectSchema: z.ZodType<Prisma.OrganizationUserScalarWhereWithAggregatesInput> = organizationuserscalarwherewithaggregatesinputSchema as unknown as z.ZodType<Prisma.OrganizationUserScalarWhereWithAggregatesInput>;
export const OrganizationUserScalarWhereWithAggregatesInputObjectZodSchema = organizationuserscalarwherewithaggregatesinputSchema;
