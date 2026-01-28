import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationRoleSchema } from '../enums/OrganizationRole.schema';
import { NullableJsonNullValueInputSchema } from '../enums/NullableJsonNullValueInput.schema';
import { OrganizationCreateNestedOneWithoutOrganizationUsersInputObjectSchema as OrganizationCreateNestedOneWithoutOrganizationUsersInputObjectSchema } from './OrganizationCreateNestedOneWithoutOrganizationUsersInput.schema';
import { UserCreateNestedOneWithoutOrganizationUsersInputObjectSchema as UserCreateNestedOneWithoutOrganizationUsersInputObjectSchema } from './UserCreateNestedOneWithoutOrganizationUsersInput.schema'

import { JsonValueSchema as jsonSchema } from '../../helpers/json-helpers';

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  role: OrganizationRoleSchema.optional(),
  entitlements: z.union([NullableJsonNullValueInputSchema, jsonSchema]).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  organization: z.lazy(() => OrganizationCreateNestedOneWithoutOrganizationUsersInputObjectSchema),
  user: z.lazy(() => UserCreateNestedOneWithoutOrganizationUsersInputObjectSchema)
}).strict();
export const OrganizationUserCreateWithoutTokensInputObjectSchema: z.ZodType<Prisma.OrganizationUserCreateWithoutTokensInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserCreateWithoutTokensInput>;
export const OrganizationUserCreateWithoutTokensInputObjectZodSchema = makeSchema();
