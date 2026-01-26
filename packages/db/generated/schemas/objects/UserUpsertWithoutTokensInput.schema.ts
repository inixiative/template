import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { UserUpdateWithoutTokensInputObjectSchema as UserUpdateWithoutTokensInputObjectSchema } from './UserUpdateWithoutTokensInput.schema';
import { UserUncheckedUpdateWithoutTokensInputObjectSchema as UserUncheckedUpdateWithoutTokensInputObjectSchema } from './UserUncheckedUpdateWithoutTokensInput.schema';
import { UserCreateWithoutTokensInputObjectSchema as UserCreateWithoutTokensInputObjectSchema } from './UserCreateWithoutTokensInput.schema';
import { UserUncheckedCreateWithoutTokensInputObjectSchema as UserUncheckedCreateWithoutTokensInputObjectSchema } from './UserUncheckedCreateWithoutTokensInput.schema';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema'

const makeSchema = () => z.object({
  update: z.union([z.lazy(() => UserUpdateWithoutTokensInputObjectSchema), z.lazy(() => UserUncheckedUpdateWithoutTokensInputObjectSchema)]),
  create: z.union([z.lazy(() => UserCreateWithoutTokensInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutTokensInputObjectSchema)]),
  where: z.lazy(() => UserWhereInputObjectSchema).optional()
}).strict();
export const UserUpsertWithoutTokensInputObjectSchema: z.ZodType<Prisma.UserUpsertWithoutTokensInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUpsertWithoutTokensInput>;
export const UserUpsertWithoutTokensInputObjectZodSchema = makeSchema();
