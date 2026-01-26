import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { UserCreateWithoutTokensInputObjectSchema as UserCreateWithoutTokensInputObjectSchema } from './UserCreateWithoutTokensInput.schema';
import { UserUncheckedCreateWithoutTokensInputObjectSchema as UserUncheckedCreateWithoutTokensInputObjectSchema } from './UserUncheckedCreateWithoutTokensInput.schema';
import { UserCreateOrConnectWithoutTokensInputObjectSchema as UserCreateOrConnectWithoutTokensInputObjectSchema } from './UserCreateOrConnectWithoutTokensInput.schema';
import { UserUpsertWithoutTokensInputObjectSchema as UserUpsertWithoutTokensInputObjectSchema } from './UserUpsertWithoutTokensInput.schema';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './UserWhereUniqueInput.schema';
import { UserUpdateToOneWithWhereWithoutTokensInputObjectSchema as UserUpdateToOneWithWhereWithoutTokensInputObjectSchema } from './UserUpdateToOneWithWhereWithoutTokensInput.schema';
import { UserUpdateWithoutTokensInputObjectSchema as UserUpdateWithoutTokensInputObjectSchema } from './UserUpdateWithoutTokensInput.schema';
import { UserUncheckedUpdateWithoutTokensInputObjectSchema as UserUncheckedUpdateWithoutTokensInputObjectSchema } from './UserUncheckedUpdateWithoutTokensInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => UserCreateWithoutTokensInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutTokensInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutTokensInputObjectSchema).optional(),
  upsert: z.lazy(() => UserUpsertWithoutTokensInputObjectSchema).optional(),
  disconnect: z.union([z.boolean(), z.lazy(() => UserWhereInputObjectSchema)]).optional(),
  delete: z.union([z.boolean(), z.lazy(() => UserWhereInputObjectSchema)]).optional(),
  connect: z.lazy(() => UserWhereUniqueInputObjectSchema).optional(),
  update: z.union([z.lazy(() => UserUpdateToOneWithWhereWithoutTokensInputObjectSchema), z.lazy(() => UserUpdateWithoutTokensInputObjectSchema), z.lazy(() => UserUncheckedUpdateWithoutTokensInputObjectSchema)]).optional()
}).strict();
export const UserUpdateOneWithoutTokensNestedInputObjectSchema: z.ZodType<Prisma.UserUpdateOneWithoutTokensNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUpdateOneWithoutTokensNestedInput>;
export const UserUpdateOneWithoutTokensNestedInputObjectZodSchema = makeSchema();
