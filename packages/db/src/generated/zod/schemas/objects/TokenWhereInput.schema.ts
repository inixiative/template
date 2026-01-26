import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringFilterObjectSchema as StringFilterObjectSchema } from './StringFilter.schema';
import { DateTimeFilterObjectSchema as DateTimeFilterObjectSchema } from './DateTimeFilter.schema';
import { EnumTokenOwnerModelFilterObjectSchema as EnumTokenOwnerModelFilterObjectSchema } from './EnumTokenOwnerModelFilter.schema';
import { TokenOwnerModelSchema } from '../enums/TokenOwnerModel.schema';
import { StringNullableFilterObjectSchema as StringNullableFilterObjectSchema } from './StringNullableFilter.schema';
import { EnumOrganizationRoleFilterObjectSchema as EnumOrganizationRoleFilterObjectSchema } from './EnumOrganizationRoleFilter.schema';
import { OrganizationRoleSchema } from '../enums/OrganizationRole.schema';
import { JsonNullableFilterObjectSchema as JsonNullableFilterObjectSchema } from './JsonNullableFilter.schema';
import { DateTimeNullableFilterObjectSchema as DateTimeNullableFilterObjectSchema } from './DateTimeNullableFilter.schema';
import { BoolFilterObjectSchema as BoolFilterObjectSchema } from './BoolFilter.schema';
import { UserNullableScalarRelationFilterObjectSchema as UserNullableScalarRelationFilterObjectSchema } from './UserNullableScalarRelationFilter.schema';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema';
import { OrganizationNullableScalarRelationFilterObjectSchema as OrganizationNullableScalarRelationFilterObjectSchema } from './OrganizationNullableScalarRelationFilter.schema';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './OrganizationWhereInput.schema';
import { OrganizationUserNullableScalarRelationFilterObjectSchema as OrganizationUserNullableScalarRelationFilterObjectSchema } from './OrganizationUserNullableScalarRelationFilter.schema';
import { OrganizationUserWhereInputObjectSchema as OrganizationUserWhereInputObjectSchema } from './OrganizationUserWhereInput.schema'

const tokenwhereinputSchema = z.object({
  AND: z.union([z.lazy(() => TokenWhereInputObjectSchema), z.lazy(() => TokenWhereInputObjectSchema).array()]).optional(),
  OR: z.lazy(() => TokenWhereInputObjectSchema).array().optional(),
  NOT: z.union([z.lazy(() => TokenWhereInputObjectSchema), z.lazy(() => TokenWhereInputObjectSchema).array()]).optional(),
  id: z.union([z.lazy(() => StringFilterObjectSchema), z.string().max(36)]).optional(),
  createdAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  updatedAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  name: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  keyHash: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  keyPrefix: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  ownerModel: z.union([z.lazy(() => EnumTokenOwnerModelFilterObjectSchema), TokenOwnerModelSchema]).optional(),
  userId: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string().max(36)]).optional().nullable(),
  organizationId: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string().max(36)]).optional().nullable(),
  role: z.union([z.lazy(() => EnumOrganizationRoleFilterObjectSchema), OrganizationRoleSchema]).optional(),
  entitlements: z.lazy(() => JsonNullableFilterObjectSchema).optional(),
  expiresAt: z.union([z.lazy(() => DateTimeNullableFilterObjectSchema), z.coerce.date()]).optional().nullable(),
  lastUsedAt: z.union([z.lazy(() => DateTimeNullableFilterObjectSchema), z.coerce.date()]).optional().nullable(),
  isActive: z.union([z.lazy(() => BoolFilterObjectSchema), z.boolean()]).optional(),
  user: z.union([z.lazy(() => UserNullableScalarRelationFilterObjectSchema), z.lazy(() => UserWhereInputObjectSchema)]).optional(),
  organization: z.union([z.lazy(() => OrganizationNullableScalarRelationFilterObjectSchema), z.lazy(() => OrganizationWhereInputObjectSchema)]).optional(),
  organizationUser: z.union([z.lazy(() => OrganizationUserNullableScalarRelationFilterObjectSchema), z.lazy(() => OrganizationUserWhereInputObjectSchema)]).optional()
}).strict();
export const TokenWhereInputObjectSchema: z.ZodType<Prisma.TokenWhereInput> = tokenwhereinputSchema as unknown as z.ZodType<Prisma.TokenWhereInput>;
export const TokenWhereInputObjectZodSchema = tokenwhereinputSchema;
