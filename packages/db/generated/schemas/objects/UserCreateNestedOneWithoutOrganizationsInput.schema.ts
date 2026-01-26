import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { UserCreateWithoutOrganizationsInputObjectSchema as UserCreateWithoutOrganizationsInputObjectSchema } from './UserCreateWithoutOrganizationsInput.schema';
import { UserUncheckedCreateWithoutOrganizationsInputObjectSchema as UserUncheckedCreateWithoutOrganizationsInputObjectSchema } from './UserUncheckedCreateWithoutOrganizationsInput.schema';
import { UserCreateOrConnectWithoutOrganizationsInputObjectSchema as UserCreateOrConnectWithoutOrganizationsInputObjectSchema } from './UserCreateOrConnectWithoutOrganizationsInput.schema';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './UserWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => UserCreateWithoutOrganizationsInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutOrganizationsInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutOrganizationsInputObjectSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputObjectSchema).optional()
}).strict();
export const UserCreateNestedOneWithoutOrganizationsInputObjectSchema: z.ZodType<Prisma.UserCreateNestedOneWithoutOrganizationsInput> = makeSchema() as unknown as z.ZodType<Prisma.UserCreateNestedOneWithoutOrganizationsInput>;
export const UserCreateNestedOneWithoutOrganizationsInputObjectZodSchema = makeSchema();
