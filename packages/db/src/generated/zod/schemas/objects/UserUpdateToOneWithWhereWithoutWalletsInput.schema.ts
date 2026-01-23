import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema';
import { UserUpdateWithoutWalletsInputObjectSchema as UserUpdateWithoutWalletsInputObjectSchema } from './UserUpdateWithoutWalletsInput.schema';
import { UserUncheckedUpdateWithoutWalletsInputObjectSchema as UserUncheckedUpdateWithoutWalletsInputObjectSchema } from './UserUncheckedUpdateWithoutWalletsInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => UserWhereInputObjectSchema).optional(),
  data: z.union([z.lazy(() => UserUpdateWithoutWalletsInputObjectSchema), z.lazy(() => UserUncheckedUpdateWithoutWalletsInputObjectSchema)])
}).strict();
export const UserUpdateToOneWithWhereWithoutWalletsInputObjectSchema: z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutWalletsInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutWalletsInput>;
export const UserUpdateToOneWithWhereWithoutWalletsInputObjectZodSchema = makeSchema();
