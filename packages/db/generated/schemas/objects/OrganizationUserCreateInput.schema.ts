import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationRoleSchema } from '../enums/OrganizationRole.schema';
import { NullableJsonNullValueInputSchema } from '../enums/NullableJsonNullValueInput.schema';
import { OrganizationCreateNestedOneWithoutUsersInputObjectSchema as OrganizationCreateNestedOneWithoutUsersInputObjectSchema } from './OrganizationCreateNestedOneWithoutUsersInput.schema';
import { UserCreateNestedOneWithoutOrganizationsInputObjectSchema as UserCreateNestedOneWithoutOrganizationsInputObjectSchema } from './UserCreateNestedOneWithoutOrganizationsInput.schema';
import { TokenCreateNestedManyWithoutOrganizationUserInputObjectSchema as TokenCreateNestedManyWithoutOrganizationUserInputObjectSchema } from './TokenCreateNestedManyWithoutOrganizationUserInput.schema'

import { JsonValueSchema as jsonSchema } from '../../helpers/json-helpers';

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  role: OrganizationRoleSchema.optional(),
  entitlements: z.union([NullableJsonNullValueInputSchema, jsonSchema]).optional(),
  createdAt: z.coerce.date().optional(),
  organization: z.lazy(() => OrganizationCreateNestedOneWithoutUsersInputObjectSchema),
  user: z.lazy(() => UserCreateNestedOneWithoutOrganizationsInputObjectSchema),
  tokens: z.lazy(() => TokenCreateNestedManyWithoutOrganizationUserInputObjectSchema).optional()
}).strict();
export const OrganizationUserCreateInputObjectSchema: z.ZodType<Prisma.OrganizationUserCreateInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserCreateInput>;
export const OrganizationUserCreateInputObjectZodSchema = makeSchema();
