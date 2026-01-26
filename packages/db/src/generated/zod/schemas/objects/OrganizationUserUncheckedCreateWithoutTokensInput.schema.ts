import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationRoleSchema } from '../enums/OrganizationRole.schema';
import { NullableJsonNullValueInputSchema } from '../enums/NullableJsonNullValueInput.schema'

import { JsonValueSchema as jsonSchema } from '../../helpers/json-helpers';

const makeSchema = () => z.object({
  id: z.string().optional(),
  organizationId: z.string(),
  userId: z.string(),
  role: OrganizationRoleSchema.optional(),
  entitlements: z.union([NullableJsonNullValueInputSchema, jsonSchema]).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional()
}).strict();
export const OrganizationUserUncheckedCreateWithoutTokensInputObjectSchema: z.ZodType<Prisma.OrganizationUserUncheckedCreateWithoutTokensInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserUncheckedCreateWithoutTokensInput>;
export const OrganizationUserUncheckedCreateWithoutTokensInputObjectZodSchema = makeSchema();
