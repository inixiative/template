import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { UserUpdateWithoutOrganizationsInputObjectSchema as UserUpdateWithoutOrganizationsInputObjectSchema } from './UserUpdateWithoutOrganizationsInput.schema';
import { UserUncheckedUpdateWithoutOrganizationsInputObjectSchema as UserUncheckedUpdateWithoutOrganizationsInputObjectSchema } from './UserUncheckedUpdateWithoutOrganizationsInput.schema';
import { UserCreateWithoutOrganizationsInputObjectSchema as UserCreateWithoutOrganizationsInputObjectSchema } from './UserCreateWithoutOrganizationsInput.schema';
import { UserUncheckedCreateWithoutOrganizationsInputObjectSchema as UserUncheckedCreateWithoutOrganizationsInputObjectSchema } from './UserUncheckedCreateWithoutOrganizationsInput.schema';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema'

const makeSchema = () => z.object({
  update: z.union([z.lazy(() => UserUpdateWithoutOrganizationsInputObjectSchema), z.lazy(() => UserUncheckedUpdateWithoutOrganizationsInputObjectSchema)]),
  create: z.union([z.lazy(() => UserCreateWithoutOrganizationsInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutOrganizationsInputObjectSchema)]),
  where: z.lazy(() => UserWhereInputObjectSchema).optional()
}).strict();
export const UserUpsertWithoutOrganizationsInputObjectSchema: z.ZodType<Prisma.UserUpsertWithoutOrganizationsInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUpsertWithoutOrganizationsInput>;
export const UserUpsertWithoutOrganizationsInputObjectZodSchema = makeSchema();
