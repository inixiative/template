import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationRoleSchema } from '../enums/OrganizationRole.schema';
import { NullableJsonNullValueInputSchema } from '../enums/NullableJsonNullValueInput.schema';
import { TokenUncheckedCreateNestedManyWithoutOrganizationUserInputObjectSchema as TokenUncheckedCreateNestedManyWithoutOrganizationUserInputObjectSchema } from './TokenUncheckedCreateNestedManyWithoutOrganizationUserInput.schema'

import { JsonValueSchema as jsonSchema } from '../../helpers/json-helpers';

const makeSchema = () => z.object({
  id: z.string().optional(),
  organizationId: z.string(),
  role: OrganizationRoleSchema.optional(),
  entitlements: z.union([NullableJsonNullValueInputSchema, jsonSchema]).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  tokens: z.lazy(() => TokenUncheckedCreateNestedManyWithoutOrganizationUserInputObjectSchema).optional()
}).strict();
export const OrganizationUserUncheckedCreateWithoutUserInputObjectSchema: z.ZodType<Prisma.OrganizationUserUncheckedCreateWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserUncheckedCreateWithoutUserInput>;
export const OrganizationUserUncheckedCreateWithoutUserInputObjectZodSchema = makeSchema();
