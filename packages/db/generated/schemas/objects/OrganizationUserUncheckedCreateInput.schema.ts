import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationRoleSchema } from '../enums/OrganizationRole.schema';
import { NullableJsonNullValueInputSchema } from '../enums/NullableJsonNullValueInput.schema';
import { TokenUncheckedCreateNestedManyWithoutOrganizationUserInputObjectSchema as TokenUncheckedCreateNestedManyWithoutOrganizationUserInputObjectSchema } from './TokenUncheckedCreateNestedManyWithoutOrganizationUserInput.schema'

import { JsonValueSchema as jsonSchema } from '../../helpers/json-helpers';

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  organizationId: z.string().max(36),
  userId: z.string().max(36),
  role: OrganizationRoleSchema.optional(),
  entitlements: z.union([NullableJsonNullValueInputSchema, jsonSchema]).optional(),
  createdAt: z.coerce.date().optional(),
  tokens: z.lazy(() => TokenUncheckedCreateNestedManyWithoutOrganizationUserInputObjectSchema).optional()
}).strict();
export const OrganizationUserUncheckedCreateInputObjectSchema: z.ZodType<Prisma.OrganizationUserUncheckedCreateInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserUncheckedCreateInput>;
export const OrganizationUserUncheckedCreateInputObjectZodSchema = makeSchema();
