import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserUpdateWithoutOrganizationUsersInputObjectSchema as UserUpdateWithoutOrganizationUsersInputObjectSchema } from './UserUpdateWithoutOrganizationUsersInput.schema';
import { UserUncheckedUpdateWithoutOrganizationUsersInputObjectSchema as UserUncheckedUpdateWithoutOrganizationUsersInputObjectSchema } from './UserUncheckedUpdateWithoutOrganizationUsersInput.schema';
import { UserCreateWithoutOrganizationUsersInputObjectSchema as UserCreateWithoutOrganizationUsersInputObjectSchema } from './UserCreateWithoutOrganizationUsersInput.schema';
import { UserUncheckedCreateWithoutOrganizationUsersInputObjectSchema as UserUncheckedCreateWithoutOrganizationUsersInputObjectSchema } from './UserUncheckedCreateWithoutOrganizationUsersInput.schema';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema'

const makeSchema = () => z.object({
  update: z.union([z.lazy(() => UserUpdateWithoutOrganizationUsersInputObjectSchema), z.lazy(() => UserUncheckedUpdateWithoutOrganizationUsersInputObjectSchema)]),
  create: z.union([z.lazy(() => UserCreateWithoutOrganizationUsersInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutOrganizationUsersInputObjectSchema)]),
  where: z.lazy(() => UserWhereInputObjectSchema).optional()
}).strict();
export const UserUpsertWithoutOrganizationUsersInputObjectSchema: z.ZodType<Prisma.UserUpsertWithoutOrganizationUsersInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUpsertWithoutOrganizationUsersInput>;
export const UserUpsertWithoutOrganizationUsersInputObjectZodSchema = makeSchema();
