import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './UserWhereUniqueInput.schema';
import { UserCreateWithoutWalletsInputObjectSchema as UserCreateWithoutWalletsInputObjectSchema } from './UserCreateWithoutWalletsInput.schema';
import { UserUncheckedCreateWithoutWalletsInputObjectSchema as UserUncheckedCreateWithoutWalletsInputObjectSchema } from './UserUncheckedCreateWithoutWalletsInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => UserWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => UserCreateWithoutWalletsInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutWalletsInputObjectSchema)])
}).strict();
export const UserCreateOrConnectWithoutWalletsInputObjectSchema: z.ZodType<Prisma.UserCreateOrConnectWithoutWalletsInput> = makeSchema() as unknown as z.ZodType<Prisma.UserCreateOrConnectWithoutWalletsInput>;
export const UserCreateOrConnectWithoutWalletsInputObjectZodSchema = makeSchema();
