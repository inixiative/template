import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { TokenOwnerModelSchema } from '../enums/TokenOwnerModel.schema';
import { OrganizationRoleSchema } from '../enums/OrganizationRole.schema';
import { NullableJsonNullValueInputSchema } from '../enums/NullableJsonNullValueInput.schema'

import { JsonValueSchema as jsonSchema } from '../../helpers/json-helpers';

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  createdAt: z.coerce.date().optional(),
  name: z.string(),
  keyHash: z.string(),
  keyPrefix: z.string(),
  ownerModel: TokenOwnerModelSchema,
  userId: z.string().max(36).optional().nullable(),
  organizationId: z.string().max(36).optional().nullable(),
  role: OrganizationRoleSchema.optional(),
  entitlements: z.union([NullableJsonNullValueInputSchema, jsonSchema]).optional(),
  expiresAt: z.coerce.date().optional().nullable(),
  lastUsedAt: z.coerce.date().optional().nullable(),
  isActive: z.boolean().optional()
}).strict();
export const TokenUncheckedCreateInputObjectSchema: z.ZodType<Prisma.TokenUncheckedCreateInput> = makeSchema() as unknown as z.ZodType<Prisma.TokenUncheckedCreateInput>;
export const TokenUncheckedCreateInputObjectZodSchema = makeSchema();
