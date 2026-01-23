import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserCreateWithoutWalletsInputObjectSchema as UserCreateWithoutWalletsInputObjectSchema } from './UserCreateWithoutWalletsInput.schema';
import { UserUncheckedCreateWithoutWalletsInputObjectSchema as UserUncheckedCreateWithoutWalletsInputObjectSchema } from './UserUncheckedCreateWithoutWalletsInput.schema';
import { UserCreateOrConnectWithoutWalletsInputObjectSchema as UserCreateOrConnectWithoutWalletsInputObjectSchema } from './UserCreateOrConnectWithoutWalletsInput.schema';
import { UserUpsertWithoutWalletsInputObjectSchema as UserUpsertWithoutWalletsInputObjectSchema } from './UserUpsertWithoutWalletsInput.schema';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './UserWhereUniqueInput.schema';
import { UserUpdateToOneWithWhereWithoutWalletsInputObjectSchema as UserUpdateToOneWithWhereWithoutWalletsInputObjectSchema } from './UserUpdateToOneWithWhereWithoutWalletsInput.schema';
import { UserUpdateWithoutWalletsInputObjectSchema as UserUpdateWithoutWalletsInputObjectSchema } from './UserUpdateWithoutWalletsInput.schema';
import { UserUncheckedUpdateWithoutWalletsInputObjectSchema as UserUncheckedUpdateWithoutWalletsInputObjectSchema } from './UserUncheckedUpdateWithoutWalletsInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => UserCreateWithoutWalletsInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutWalletsInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutWalletsInputObjectSchema).optional(),
  upsert: z.lazy(() => UserUpsertWithoutWalletsInputObjectSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputObjectSchema).optional(),
  update: z.union([z.lazy(() => UserUpdateToOneWithWhereWithoutWalletsInputObjectSchema), z.lazy(() => UserUpdateWithoutWalletsInputObjectSchema), z.lazy(() => UserUncheckedUpdateWithoutWalletsInputObjectSchema)]).optional()
}).strict();
export const UserUpdateOneRequiredWithoutWalletsNestedInputObjectSchema: z.ZodType<Prisma.UserUpdateOneRequiredWithoutWalletsNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUpdateOneRequiredWithoutWalletsNestedInput>;
export const UserUpdateOneRequiredWithoutWalletsNestedInputObjectZodSchema = makeSchema();
