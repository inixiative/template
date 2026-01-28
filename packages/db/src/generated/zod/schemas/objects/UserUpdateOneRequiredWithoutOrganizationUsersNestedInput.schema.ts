import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserCreateWithoutOrganizationUsersInputObjectSchema as UserCreateWithoutOrganizationUsersInputObjectSchema } from './UserCreateWithoutOrganizationUsersInput.schema';
import { UserUncheckedCreateWithoutOrganizationUsersInputObjectSchema as UserUncheckedCreateWithoutOrganizationUsersInputObjectSchema } from './UserUncheckedCreateWithoutOrganizationUsersInput.schema';
import { UserCreateOrConnectWithoutOrganizationUsersInputObjectSchema as UserCreateOrConnectWithoutOrganizationUsersInputObjectSchema } from './UserCreateOrConnectWithoutOrganizationUsersInput.schema';
import { UserUpsertWithoutOrganizationUsersInputObjectSchema as UserUpsertWithoutOrganizationUsersInputObjectSchema } from './UserUpsertWithoutOrganizationUsersInput.schema';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './UserWhereUniqueInput.schema';
import { UserUpdateToOneWithWhereWithoutOrganizationUsersInputObjectSchema as UserUpdateToOneWithWhereWithoutOrganizationUsersInputObjectSchema } from './UserUpdateToOneWithWhereWithoutOrganizationUsersInput.schema';
import { UserUpdateWithoutOrganizationUsersInputObjectSchema as UserUpdateWithoutOrganizationUsersInputObjectSchema } from './UserUpdateWithoutOrganizationUsersInput.schema';
import { UserUncheckedUpdateWithoutOrganizationUsersInputObjectSchema as UserUncheckedUpdateWithoutOrganizationUsersInputObjectSchema } from './UserUncheckedUpdateWithoutOrganizationUsersInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => UserCreateWithoutOrganizationUsersInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutOrganizationUsersInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutOrganizationUsersInputObjectSchema).optional(),
  upsert: z.lazy(() => UserUpsertWithoutOrganizationUsersInputObjectSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputObjectSchema).optional(),
  update: z.union([z.lazy(() => UserUpdateToOneWithWhereWithoutOrganizationUsersInputObjectSchema), z.lazy(() => UserUpdateWithoutOrganizationUsersInputObjectSchema), z.lazy(() => UserUncheckedUpdateWithoutOrganizationUsersInputObjectSchema)]).optional()
}).strict();
export const UserUpdateOneRequiredWithoutOrganizationUsersNestedInputObjectSchema: z.ZodType<Prisma.UserUpdateOneRequiredWithoutOrganizationUsersNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUpdateOneRequiredWithoutOrganizationUsersNestedInput>;
export const UserUpdateOneRequiredWithoutOrganizationUsersNestedInputObjectZodSchema = makeSchema();
