import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserUpdateWithoutWalletsInputObjectSchema as UserUpdateWithoutWalletsInputObjectSchema } from './UserUpdateWithoutWalletsInput.schema';
import { UserUncheckedUpdateWithoutWalletsInputObjectSchema as UserUncheckedUpdateWithoutWalletsInputObjectSchema } from './UserUncheckedUpdateWithoutWalletsInput.schema';
import { UserCreateWithoutWalletsInputObjectSchema as UserCreateWithoutWalletsInputObjectSchema } from './UserCreateWithoutWalletsInput.schema';
import { UserUncheckedCreateWithoutWalletsInputObjectSchema as UserUncheckedCreateWithoutWalletsInputObjectSchema } from './UserUncheckedCreateWithoutWalletsInput.schema';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema'

const makeSchema = () => z.object({
  update: z.union([z.lazy(() => UserUpdateWithoutWalletsInputObjectSchema), z.lazy(() => UserUncheckedUpdateWithoutWalletsInputObjectSchema)]),
  create: z.union([z.lazy(() => UserCreateWithoutWalletsInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutWalletsInputObjectSchema)]),
  where: z.lazy(() => UserWhereInputObjectSchema).optional()
}).strict();
export const UserUpsertWithoutWalletsInputObjectSchema: z.ZodType<Prisma.UserUpsertWithoutWalletsInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUpsertWithoutWalletsInput>;
export const UserUpsertWithoutWalletsInputObjectZodSchema = makeSchema();
