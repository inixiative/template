import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema';
import { UserUpdateWithoutOrganizationUsersInputObjectSchema as UserUpdateWithoutOrganizationUsersInputObjectSchema } from './UserUpdateWithoutOrganizationUsersInput.schema';
import { UserUncheckedUpdateWithoutOrganizationUsersInputObjectSchema as UserUncheckedUpdateWithoutOrganizationUsersInputObjectSchema } from './UserUncheckedUpdateWithoutOrganizationUsersInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => UserWhereInputObjectSchema).optional(),
  data: z.union([z.lazy(() => UserUpdateWithoutOrganizationUsersInputObjectSchema), z.lazy(() => UserUncheckedUpdateWithoutOrganizationUsersInputObjectSchema)])
}).strict();
export const UserUpdateToOneWithWhereWithoutOrganizationUsersInputObjectSchema: z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutOrganizationUsersInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutOrganizationUsersInput>;
export const UserUpdateToOneWithWhereWithoutOrganizationUsersInputObjectZodSchema = makeSchema();
