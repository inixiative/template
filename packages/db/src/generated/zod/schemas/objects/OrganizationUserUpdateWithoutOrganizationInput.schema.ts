import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringFieldUpdateOperationsInputObjectSchema as StringFieldUpdateOperationsInputObjectSchema } from './StringFieldUpdateOperationsInput.schema';
import { OrganizationRoleSchema } from '../enums/OrganizationRole.schema';
import { EnumOrganizationRoleFieldUpdateOperationsInputObjectSchema as EnumOrganizationRoleFieldUpdateOperationsInputObjectSchema } from './EnumOrganizationRoleFieldUpdateOperationsInput.schema';
import { NullableJsonNullValueInputSchema } from '../enums/NullableJsonNullValueInput.schema';
import { DateTimeFieldUpdateOperationsInputObjectSchema as DateTimeFieldUpdateOperationsInputObjectSchema } from './DateTimeFieldUpdateOperationsInput.schema';
import { UserUpdateOneRequiredWithoutOrganizationUsersNestedInputObjectSchema as UserUpdateOneRequiredWithoutOrganizationUsersNestedInputObjectSchema } from './UserUpdateOneRequiredWithoutOrganizationUsersNestedInput.schema';
import { TokenUpdateManyWithoutOrganizationUserNestedInputObjectSchema as TokenUpdateManyWithoutOrganizationUserNestedInputObjectSchema } from './TokenUpdateManyWithoutOrganizationUserNestedInput.schema'

import { JsonValueSchema as jsonSchema } from '../../helpers/json-helpers';

const makeSchema = () => z.object({
  id: z.union([z.string().max(36), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  role: z.union([OrganizationRoleSchema, z.lazy(() => EnumOrganizationRoleFieldUpdateOperationsInputObjectSchema)]).optional(),
  entitlements: z.union([NullableJsonNullValueInputSchema, jsonSchema]).optional(),
  createdAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  updatedAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  user: z.lazy(() => UserUpdateOneRequiredWithoutOrganizationUsersNestedInputObjectSchema).optional(),
  tokens: z.lazy(() => TokenUpdateManyWithoutOrganizationUserNestedInputObjectSchema).optional()
}).strict();
export const OrganizationUserUpdateWithoutOrganizationInputObjectSchema: z.ZodType<Prisma.OrganizationUserUpdateWithoutOrganizationInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserUpdateWithoutOrganizationInput>;
export const OrganizationUserUpdateWithoutOrganizationInputObjectZodSchema = makeSchema();
