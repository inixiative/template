import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringFilterObjectSchema as StringFilterObjectSchema } from './StringFilter.schema';
import { EnumOrganizationRoleFilterObjectSchema as EnumOrganizationRoleFilterObjectSchema } from './EnumOrganizationRoleFilter.schema';
import { OrganizationRoleSchema } from '../enums/OrganizationRole.schema';
import { JsonNullableFilterObjectSchema as JsonNullableFilterObjectSchema } from './JsonNullableFilter.schema';
import { DateTimeFilterObjectSchema as DateTimeFilterObjectSchema } from './DateTimeFilter.schema';
import { OrganizationScalarRelationFilterObjectSchema as OrganizationScalarRelationFilterObjectSchema } from './OrganizationScalarRelationFilter.schema';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './OrganizationWhereInput.schema';
import { UserScalarRelationFilterObjectSchema as UserScalarRelationFilterObjectSchema } from './UserScalarRelationFilter.schema';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema';
import { TokenListRelationFilterObjectSchema as TokenListRelationFilterObjectSchema } from './TokenListRelationFilter.schema'

const organizationuserwhereinputSchema = z.object({
  AND: z.union([z.lazy(() => OrganizationUserWhereInputObjectSchema), z.lazy(() => OrganizationUserWhereInputObjectSchema).array()]).optional(),
  OR: z.lazy(() => OrganizationUserWhereInputObjectSchema).array().optional(),
  NOT: z.union([z.lazy(() => OrganizationUserWhereInputObjectSchema), z.lazy(() => OrganizationUserWhereInputObjectSchema).array()]).optional(),
  id: z.union([z.lazy(() => StringFilterObjectSchema), z.string().max(36)]).optional(),
  organizationId: z.union([z.lazy(() => StringFilterObjectSchema), z.string().max(36)]).optional(),
  userId: z.union([z.lazy(() => StringFilterObjectSchema), z.string().max(36)]).optional(),
  role: z.union([z.lazy(() => EnumOrganizationRoleFilterObjectSchema), OrganizationRoleSchema]).optional(),
  entitlements: z.lazy(() => JsonNullableFilterObjectSchema).optional(),
  createdAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  updatedAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  organization: z.union([z.lazy(() => OrganizationScalarRelationFilterObjectSchema), z.lazy(() => OrganizationWhereInputObjectSchema)]).optional(),
  user: z.union([z.lazy(() => UserScalarRelationFilterObjectSchema), z.lazy(() => UserWhereInputObjectSchema)]).optional(),
  tokens: z.lazy(() => TokenListRelationFilterObjectSchema).optional()
}).strict();
export const OrganizationUserWhereInputObjectSchema: z.ZodType<Prisma.OrganizationUserWhereInput> = organizationuserwhereinputSchema as unknown as z.ZodType<Prisma.OrganizationUserWhereInput>;
export const OrganizationUserWhereInputObjectZodSchema = organizationuserwhereinputSchema;
