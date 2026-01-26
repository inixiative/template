import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringWithAggregatesFilterObjectSchema as StringWithAggregatesFilterObjectSchema } from './StringWithAggregatesFilter.schema';
import { DateTimeWithAggregatesFilterObjectSchema as DateTimeWithAggregatesFilterObjectSchema } from './DateTimeWithAggregatesFilter.schema';
import { EnumTokenOwnerModelWithAggregatesFilterObjectSchema as EnumTokenOwnerModelWithAggregatesFilterObjectSchema } from './EnumTokenOwnerModelWithAggregatesFilter.schema';
import { TokenOwnerModelSchema } from '../enums/TokenOwnerModel.schema';
import { StringNullableWithAggregatesFilterObjectSchema as StringNullableWithAggregatesFilterObjectSchema } from './StringNullableWithAggregatesFilter.schema';
import { EnumOrganizationRoleWithAggregatesFilterObjectSchema as EnumOrganizationRoleWithAggregatesFilterObjectSchema } from './EnumOrganizationRoleWithAggregatesFilter.schema';
import { OrganizationRoleSchema } from '../enums/OrganizationRole.schema';
import { JsonNullableWithAggregatesFilterObjectSchema as JsonNullableWithAggregatesFilterObjectSchema } from './JsonNullableWithAggregatesFilter.schema';
import { DateTimeNullableWithAggregatesFilterObjectSchema as DateTimeNullableWithAggregatesFilterObjectSchema } from './DateTimeNullableWithAggregatesFilter.schema';
import { BoolWithAggregatesFilterObjectSchema as BoolWithAggregatesFilterObjectSchema } from './BoolWithAggregatesFilter.schema'

const tokenscalarwherewithaggregatesinputSchema = z.object({
  AND: z.union([z.lazy(() => TokenScalarWhereWithAggregatesInputObjectSchema), z.lazy(() => TokenScalarWhereWithAggregatesInputObjectSchema).array()]).optional(),
  OR: z.lazy(() => TokenScalarWhereWithAggregatesInputObjectSchema).array().optional(),
  NOT: z.union([z.lazy(() => TokenScalarWhereWithAggregatesInputObjectSchema), z.lazy(() => TokenScalarWhereWithAggregatesInputObjectSchema).array()]).optional(),
  id: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string().max(36)]).optional(),
  createdAt: z.union([z.lazy(() => DateTimeWithAggregatesFilterObjectSchema), z.coerce.date()]).optional(),
  updatedAt: z.union([z.lazy(() => DateTimeWithAggregatesFilterObjectSchema), z.coerce.date()]).optional(),
  name: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string()]).optional(),
  keyHash: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string()]).optional(),
  keyPrefix: z.union([z.lazy(() => StringWithAggregatesFilterObjectSchema), z.string()]).optional(),
  ownerModel: z.union([z.lazy(() => EnumTokenOwnerModelWithAggregatesFilterObjectSchema), TokenOwnerModelSchema]).optional(),
  userId: z.union([z.lazy(() => StringNullableWithAggregatesFilterObjectSchema), z.string().max(36)]).optional().nullable(),
  organizationId: z.union([z.lazy(() => StringNullableWithAggregatesFilterObjectSchema), z.string().max(36)]).optional().nullable(),
  role: z.union([z.lazy(() => EnumOrganizationRoleWithAggregatesFilterObjectSchema), OrganizationRoleSchema]).optional(),
  entitlements: z.lazy(() => JsonNullableWithAggregatesFilterObjectSchema).optional(),
  expiresAt: z.union([z.lazy(() => DateTimeNullableWithAggregatesFilterObjectSchema), z.coerce.date()]).optional().nullable(),
  lastUsedAt: z.union([z.lazy(() => DateTimeNullableWithAggregatesFilterObjectSchema), z.coerce.date()]).optional().nullable(),
  isActive: z.union([z.lazy(() => BoolWithAggregatesFilterObjectSchema), z.boolean()]).optional()
}).strict();
export const TokenScalarWhereWithAggregatesInputObjectSchema: z.ZodType<Prisma.TokenScalarWhereWithAggregatesInput> = tokenscalarwherewithaggregatesinputSchema as unknown as z.ZodType<Prisma.TokenScalarWhereWithAggregatesInput>;
export const TokenScalarWhereWithAggregatesInputObjectZodSchema = tokenscalarwherewithaggregatesinputSchema;
