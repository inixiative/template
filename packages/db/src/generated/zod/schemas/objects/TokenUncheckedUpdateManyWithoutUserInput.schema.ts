import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringFieldUpdateOperationsInputObjectSchema as StringFieldUpdateOperationsInputObjectSchema } from './StringFieldUpdateOperationsInput.schema';
import { DateTimeFieldUpdateOperationsInputObjectSchema as DateTimeFieldUpdateOperationsInputObjectSchema } from './DateTimeFieldUpdateOperationsInput.schema';
import { TokenOwnerModelSchema } from '../enums/TokenOwnerModel.schema';
import { EnumTokenOwnerModelFieldUpdateOperationsInputObjectSchema as EnumTokenOwnerModelFieldUpdateOperationsInputObjectSchema } from './EnumTokenOwnerModelFieldUpdateOperationsInput.schema';
import { NullableStringFieldUpdateOperationsInputObjectSchema as NullableStringFieldUpdateOperationsInputObjectSchema } from './NullableStringFieldUpdateOperationsInput.schema';
import { OrganizationRoleSchema } from '../enums/OrganizationRole.schema';
import { EnumOrganizationRoleFieldUpdateOperationsInputObjectSchema as EnumOrganizationRoleFieldUpdateOperationsInputObjectSchema } from './EnumOrganizationRoleFieldUpdateOperationsInput.schema';
import { NullableJsonNullValueInputSchema } from '../enums/NullableJsonNullValueInput.schema';
import { NullableDateTimeFieldUpdateOperationsInputObjectSchema as NullableDateTimeFieldUpdateOperationsInputObjectSchema } from './NullableDateTimeFieldUpdateOperationsInput.schema';
import { BoolFieldUpdateOperationsInputObjectSchema as BoolFieldUpdateOperationsInputObjectSchema } from './BoolFieldUpdateOperationsInput.schema'

import { JsonValueSchema as jsonSchema } from '../../helpers/json-helpers';

const makeSchema = () => z.object({
  id: z.union([z.string().max(36), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  createdAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  updatedAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  name: z.union([z.string(), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  keyHash: z.union([z.string(), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  keyPrefix: z.union([z.string(), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  ownerModel: z.union([TokenOwnerModelSchema, z.lazy(() => EnumTokenOwnerModelFieldUpdateOperationsInputObjectSchema)]).optional(),
  organizationId: z.union([z.string().max(36), z.lazy(() => NullableStringFieldUpdateOperationsInputObjectSchema)]).optional().nullable(),
  role: z.union([OrganizationRoleSchema, z.lazy(() => EnumOrganizationRoleFieldUpdateOperationsInputObjectSchema)]).optional(),
  entitlements: z.union([NullableJsonNullValueInputSchema, jsonSchema]).optional(),
  expiresAt: z.union([z.coerce.date(), z.lazy(() => NullableDateTimeFieldUpdateOperationsInputObjectSchema)]).optional().nullable(),
  lastUsedAt: z.union([z.coerce.date(), z.lazy(() => NullableDateTimeFieldUpdateOperationsInputObjectSchema)]).optional().nullable(),
  isActive: z.union([z.boolean(), z.lazy(() => BoolFieldUpdateOperationsInputObjectSchema)]).optional()
}).strict();
export const TokenUncheckedUpdateManyWithoutUserInputObjectSchema: z.ZodType<Prisma.TokenUncheckedUpdateManyWithoutUserInput> = makeSchema() as unknown as z.ZodType<Prisma.TokenUncheckedUpdateManyWithoutUserInput>;
export const TokenUncheckedUpdateManyWithoutUserInputObjectZodSchema = makeSchema();
