import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './UserWhereUniqueInput.schema';
import { UserCreateWithoutOrganizationUsersInputObjectSchema as UserCreateWithoutOrganizationUsersInputObjectSchema } from './UserCreateWithoutOrganizationUsersInput.schema';
import { UserUncheckedCreateWithoutOrganizationUsersInputObjectSchema as UserUncheckedCreateWithoutOrganizationUsersInputObjectSchema } from './UserUncheckedCreateWithoutOrganizationUsersInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => UserWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => UserCreateWithoutOrganizationUsersInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutOrganizationUsersInputObjectSchema)])
}).strict();
export const UserCreateOrConnectWithoutOrganizationUsersInputObjectSchema: z.ZodType<Prisma.UserCreateOrConnectWithoutOrganizationUsersInput> = makeSchema() as unknown as z.ZodType<Prisma.UserCreateOrConnectWithoutOrganizationUsersInput>;
export const UserCreateOrConnectWithoutOrganizationUsersInputObjectZodSchema = makeSchema();
