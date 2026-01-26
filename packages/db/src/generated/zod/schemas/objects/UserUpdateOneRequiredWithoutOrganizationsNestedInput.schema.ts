import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserCreateWithoutOrganizationsInputObjectSchema as UserCreateWithoutOrganizationsInputObjectSchema } from './UserCreateWithoutOrganizationsInput.schema';
import { UserUncheckedCreateWithoutOrganizationsInputObjectSchema as UserUncheckedCreateWithoutOrganizationsInputObjectSchema } from './UserUncheckedCreateWithoutOrganizationsInput.schema';
import { UserCreateOrConnectWithoutOrganizationsInputObjectSchema as UserCreateOrConnectWithoutOrganizationsInputObjectSchema } from './UserCreateOrConnectWithoutOrganizationsInput.schema';
import { UserUpsertWithoutOrganizationsInputObjectSchema as UserUpsertWithoutOrganizationsInputObjectSchema } from './UserUpsertWithoutOrganizationsInput.schema';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './UserWhereUniqueInput.schema';
import { UserUpdateToOneWithWhereWithoutOrganizationsInputObjectSchema as UserUpdateToOneWithWhereWithoutOrganizationsInputObjectSchema } from './UserUpdateToOneWithWhereWithoutOrganizationsInput.schema';
import { UserUpdateWithoutOrganizationsInputObjectSchema as UserUpdateWithoutOrganizationsInputObjectSchema } from './UserUpdateWithoutOrganizationsInput.schema';
import { UserUncheckedUpdateWithoutOrganizationsInputObjectSchema as UserUncheckedUpdateWithoutOrganizationsInputObjectSchema } from './UserUncheckedUpdateWithoutOrganizationsInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => UserCreateWithoutOrganizationsInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutOrganizationsInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutOrganizationsInputObjectSchema).optional(),
  upsert: z.lazy(() => UserUpsertWithoutOrganizationsInputObjectSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputObjectSchema).optional(),
  update: z.union([z.lazy(() => UserUpdateToOneWithWhereWithoutOrganizationsInputObjectSchema), z.lazy(() => UserUpdateWithoutOrganizationsInputObjectSchema), z.lazy(() => UserUncheckedUpdateWithoutOrganizationsInputObjectSchema)]).optional()
}).strict();
export const UserUpdateOneRequiredWithoutOrganizationsNestedInputObjectSchema: z.ZodType<Prisma.UserUpdateOneRequiredWithoutOrganizationsNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUpdateOneRequiredWithoutOrganizationsNestedInput>;
export const UserUpdateOneRequiredWithoutOrganizationsNestedInputObjectZodSchema = makeSchema();
