import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationRoleSchema } from '../enums/OrganizationRole.schema';
import { NullableJsonNullValueInputSchema } from '../enums/NullableJsonNullValueInput.schema'

import { JsonValueSchema as jsonSchema } from '../../helpers/json-helpers';

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  userId: z.string().max(36),
  role: OrganizationRoleSchema.optional(),
  entitlements: z.union([NullableJsonNullValueInputSchema, jsonSchema]).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional()
}).strict();
export const OrganizationUserCreateManyOrganizationInputObjectSchema: z.ZodType<Prisma.OrganizationUserCreateManyOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserCreateManyOrganizationInput>;
export const OrganizationUserCreateManyOrganizationInputObjectZodSchema = makeSchema();
