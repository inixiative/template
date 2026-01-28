import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserCreateWithoutOrganizationUsersInputObjectSchema as UserCreateWithoutOrganizationUsersInputObjectSchema } from './UserCreateWithoutOrganizationUsersInput.schema';
import { UserUncheckedCreateWithoutOrganizationUsersInputObjectSchema as UserUncheckedCreateWithoutOrganizationUsersInputObjectSchema } from './UserUncheckedCreateWithoutOrganizationUsersInput.schema';
import { UserCreateOrConnectWithoutOrganizationUsersInputObjectSchema as UserCreateOrConnectWithoutOrganizationUsersInputObjectSchema } from './UserCreateOrConnectWithoutOrganizationUsersInput.schema';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './UserWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => UserCreateWithoutOrganizationUsersInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutOrganizationUsersInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutOrganizationUsersInputObjectSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputObjectSchema).optional()
}).strict();
export const UserCreateNestedOneWithoutOrganizationUsersInputObjectSchema: z.ZodType<Prisma.UserCreateNestedOneWithoutOrganizationUsersInput> = makeSchema() as unknown as z.ZodType<Prisma.UserCreateNestedOneWithoutOrganizationUsersInput>;
export const UserCreateNestedOneWithoutOrganizationUsersInputObjectZodSchema = makeSchema();
