import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationRoleSchema } from '../enums/OrganizationRole.schema';
import { NullableJsonNullValueInputSchema } from '../enums/NullableJsonNullValueInput.schema';
import { OrganizationCreateNestedOneWithoutOrganizationUsersInputObjectSchema as OrganizationCreateNestedOneWithoutOrganizationUsersInputObjectSchema } from './OrganizationCreateNestedOneWithoutOrganizationUsersInput.schema';
import { UserCreateNestedOneWithoutOrganizationUsersInputObjectSchema as UserCreateNestedOneWithoutOrganizationUsersInputObjectSchema } from './UserCreateNestedOneWithoutOrganizationUsersInput.schema';
import { TokenCreateNestedManyWithoutOrganizationUserInputObjectSchema as TokenCreateNestedManyWithoutOrganizationUserInputObjectSchema } from './TokenCreateNestedManyWithoutOrganizationUserInput.schema'

import { JsonValueSchema as jsonSchema } from '../../helpers/json-helpers';

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  role: OrganizationRoleSchema.optional(),
  entitlements: z.union([NullableJsonNullValueInputSchema, jsonSchema]).optional(),
  createdAt: z.coerce.date().optional(),
  organization: z.lazy(() => OrganizationCreateNestedOneWithoutOrganizationUsersInputObjectSchema),
  user: z.lazy(() => UserCreateNestedOneWithoutOrganizationUsersInputObjectSchema),
  tokens: z.lazy(() => TokenCreateNestedManyWithoutOrganizationUserInputObjectSchema).optional()
}).strict();
export const OrganizationUserCreateInputObjectSchema: z.ZodType<Prisma.OrganizationUserCreateInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserCreateInput>;
export const OrganizationUserCreateInputObjectZodSchema = makeSchema();
