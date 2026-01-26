import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { StringFieldUpdateOperationsInputObjectSchema as StringFieldUpdateOperationsInputObjectSchema } from './StringFieldUpdateOperationsInput.schema';
import { OrganizationRoleSchema } from '../enums/OrganizationRole.schema';
import { EnumOrganizationRoleFieldUpdateOperationsInputObjectSchema as EnumOrganizationRoleFieldUpdateOperationsInputObjectSchema } from './EnumOrganizationRoleFieldUpdateOperationsInput.schema';
import { NullableJsonNullValueInputSchema } from '../enums/NullableJsonNullValueInput.schema';
import { DateTimeFieldUpdateOperationsInputObjectSchema as DateTimeFieldUpdateOperationsInputObjectSchema } from './DateTimeFieldUpdateOperationsInput.schema';
import { TokenUncheckedUpdateManyWithoutOrganizationUserNestedInputObjectSchema as TokenUncheckedUpdateManyWithoutOrganizationUserNestedInputObjectSchema } from './TokenUncheckedUpdateManyWithoutOrganizationUserNestedInput.schema'

import { JsonValueSchema as jsonSchema } from '../../helpers/json-helpers';

const makeSchema = () => z.object({
  id: z.union([z.string().max(36), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  organizationId: z.union([z.string().max(36), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  userId: z.union([z.string().max(36), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  role: z.union([OrganizationRoleSchema, z.lazy(() => EnumOrganizationRoleFieldUpdateOperationsInputObjectSchema)]).optional(),
  entitlements: z.union([NullableJsonNullValueInputSchema, jsonSchema]).optional(),
  createdAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  updatedAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  tokens: z.lazy(() => TokenUncheckedUpdateManyWithoutOrganizationUserNestedInputObjectSchema).optional()
}).strict();
export const OrganizationUserUncheckedUpdateInputObjectSchema: z.ZodType<Prisma.OrganizationUserUncheckedUpdateInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserUncheckedUpdateInput>;
export const OrganizationUserUncheckedUpdateInputObjectZodSchema = makeSchema();
