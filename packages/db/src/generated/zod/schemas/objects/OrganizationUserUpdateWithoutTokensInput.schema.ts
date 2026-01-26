import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { StringFieldUpdateOperationsInputObjectSchema as StringFieldUpdateOperationsInputObjectSchema } from './StringFieldUpdateOperationsInput.schema';
import { OrganizationRoleSchema } from '../enums/OrganizationRole.schema';
import { EnumOrganizationRoleFieldUpdateOperationsInputObjectSchema as EnumOrganizationRoleFieldUpdateOperationsInputObjectSchema } from './EnumOrganizationRoleFieldUpdateOperationsInput.schema';
import { NullableJsonNullValueInputSchema } from '../enums/NullableJsonNullValueInput.schema';
import { DateTimeFieldUpdateOperationsInputObjectSchema as DateTimeFieldUpdateOperationsInputObjectSchema } from './DateTimeFieldUpdateOperationsInput.schema';
import { OrganizationUpdateOneRequiredWithoutOrganizationUsersNestedInputObjectSchema as OrganizationUpdateOneRequiredWithoutOrganizationUsersNestedInputObjectSchema } from './OrganizationUpdateOneRequiredWithoutOrganizationUsersNestedInput.schema';
import { UserUpdateOneRequiredWithoutOrganizationsNestedInputObjectSchema as UserUpdateOneRequiredWithoutOrganizationsNestedInputObjectSchema } from './UserUpdateOneRequiredWithoutOrganizationsNestedInput.schema'

import { JsonValueSchema as jsonSchema } from '../../helpers/json-helpers';

const makeSchema = () => z.object({
  id: z.union([z.string().max(36), z.lazy(() => StringFieldUpdateOperationsInputObjectSchema)]).optional(),
  role: z.union([OrganizationRoleSchema, z.lazy(() => EnumOrganizationRoleFieldUpdateOperationsInputObjectSchema)]).optional(),
  entitlements: z.union([NullableJsonNullValueInputSchema, jsonSchema]).optional(),
  createdAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  updatedAt: z.union([z.coerce.date(), z.lazy(() => DateTimeFieldUpdateOperationsInputObjectSchema)]).optional(),
  organization: z.lazy(() => OrganizationUpdateOneRequiredWithoutOrganizationUsersNestedInputObjectSchema).optional(),
  user: z.lazy(() => UserUpdateOneRequiredWithoutOrganizationsNestedInputObjectSchema).optional()
}).strict();
export const OrganizationUserUpdateWithoutTokensInputObjectSchema: z.ZodType<Prisma.OrganizationUserUpdateWithoutTokensInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUserUpdateWithoutTokensInput>;
export const OrganizationUserUpdateWithoutTokensInputObjectZodSchema = makeSchema();
