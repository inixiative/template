import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './UserWhereUniqueInput.schema';
import { UserCreateWithoutOrganizationsInputObjectSchema as UserCreateWithoutOrganizationsInputObjectSchema } from './UserCreateWithoutOrganizationsInput.schema';
import { UserUncheckedCreateWithoutOrganizationsInputObjectSchema as UserUncheckedCreateWithoutOrganizationsInputObjectSchema } from './UserUncheckedCreateWithoutOrganizationsInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => UserWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => UserCreateWithoutOrganizationsInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutOrganizationsInputObjectSchema)])
}).strict();
export const UserCreateOrConnectWithoutOrganizationsInputObjectSchema: z.ZodType<Prisma.UserCreateOrConnectWithoutOrganizationsInput> = makeSchema() as unknown as z.ZodType<Prisma.UserCreateOrConnectWithoutOrganizationsInput>;
export const UserCreateOrConnectWithoutOrganizationsInputObjectZodSchema = makeSchema();
