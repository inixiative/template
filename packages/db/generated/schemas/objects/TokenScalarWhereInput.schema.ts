import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { StringFilterObjectSchema as StringFilterObjectSchema } from './StringFilter.schema';
import { DateTimeFilterObjectSchema as DateTimeFilterObjectSchema } from './DateTimeFilter.schema';
import { EnumTokenOwnerModelFilterObjectSchema as EnumTokenOwnerModelFilterObjectSchema } from './EnumTokenOwnerModelFilter.schema';
import { TokenOwnerModelSchema } from '../enums/TokenOwnerModel.schema';
import { StringNullableFilterObjectSchema as StringNullableFilterObjectSchema } from './StringNullableFilter.schema';
import { EnumOrganizationRoleFilterObjectSchema as EnumOrganizationRoleFilterObjectSchema } from './EnumOrganizationRoleFilter.schema';
import { OrganizationRoleSchema } from '../enums/OrganizationRole.schema';
import { JsonNullableFilterObjectSchema as JsonNullableFilterObjectSchema } from './JsonNullableFilter.schema';
import { DateTimeNullableFilterObjectSchema as DateTimeNullableFilterObjectSchema } from './DateTimeNullableFilter.schema';
import { BoolFilterObjectSchema as BoolFilterObjectSchema } from './BoolFilter.schema'

const tokenscalarwhereinputSchema = z.object({
  AND: z.union([z.lazy(() => TokenScalarWhereInputObjectSchema), z.lazy(() => TokenScalarWhereInputObjectSchema).array()]).optional(),
  OR: z.lazy(() => TokenScalarWhereInputObjectSchema).array().optional(),
  NOT: z.union([z.lazy(() => TokenScalarWhereInputObjectSchema), z.lazy(() => TokenScalarWhereInputObjectSchema).array()]).optional(),
  id: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  createdAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  updatedAt: z.union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()]).optional(),
  name: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  keyHash: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  keyPrefix: z.union([z.lazy(() => StringFilterObjectSchema), z.string()]).optional(),
  ownerModel: z.union([z.lazy(() => EnumTokenOwnerModelFilterObjectSchema), TokenOwnerModelSchema]).optional(),
  userId: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string()]).optional().nullable(),
  organizationId: z.union([z.lazy(() => StringNullableFilterObjectSchema), z.string()]).optional().nullable(),
  role: z.union([z.lazy(() => EnumOrganizationRoleFilterObjectSchema), OrganizationRoleSchema]).optional(),
  entitlements: z.lazy(() => JsonNullableFilterObjectSchema).optional(),
  expiresAt: z.union([z.lazy(() => DateTimeNullableFilterObjectSchema), z.coerce.date()]).optional().nullable(),
  lastUsedAt: z.union([z.lazy(() => DateTimeNullableFilterObjectSchema), z.coerce.date()]).optional().nullable(),
  isActive: z.union([z.lazy(() => BoolFilterObjectSchema), z.boolean()]).optional()
}).strict();
export const TokenScalarWhereInputObjectSchema: z.ZodType<Prisma.TokenScalarWhereInput> = tokenscalarwhereinputSchema as unknown as z.ZodType<Prisma.TokenScalarWhereInput>;
export const TokenScalarWhereInputObjectZodSchema = tokenscalarwhereinputSchema;
