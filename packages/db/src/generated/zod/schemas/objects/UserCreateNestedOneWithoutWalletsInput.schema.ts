import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserCreateWithoutWalletsInputObjectSchema as UserCreateWithoutWalletsInputObjectSchema } from './UserCreateWithoutWalletsInput.schema';
import { UserUncheckedCreateWithoutWalletsInputObjectSchema as UserUncheckedCreateWithoutWalletsInputObjectSchema } from './UserUncheckedCreateWithoutWalletsInput.schema';
import { UserCreateOrConnectWithoutWalletsInputObjectSchema as UserCreateOrConnectWithoutWalletsInputObjectSchema } from './UserCreateOrConnectWithoutWalletsInput.schema';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './UserWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => UserCreateWithoutWalletsInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutWalletsInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutWalletsInputObjectSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputObjectSchema).optional()
}).strict();
export const UserCreateNestedOneWithoutWalletsInputObjectSchema: z.ZodType<Prisma.UserCreateNestedOneWithoutWalletsInput> = makeSchema() as unknown as z.ZodType<Prisma.UserCreateNestedOneWithoutWalletsInput>;
export const UserCreateNestedOneWithoutWalletsInputObjectZodSchema = makeSchema();
