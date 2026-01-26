import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { UserCreateWithoutTokensInputObjectSchema as UserCreateWithoutTokensInputObjectSchema } from './UserCreateWithoutTokensInput.schema';
import { UserUncheckedCreateWithoutTokensInputObjectSchema as UserUncheckedCreateWithoutTokensInputObjectSchema } from './UserUncheckedCreateWithoutTokensInput.schema';
import { UserCreateOrConnectWithoutTokensInputObjectSchema as UserCreateOrConnectWithoutTokensInputObjectSchema } from './UserCreateOrConnectWithoutTokensInput.schema';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './UserWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => UserCreateWithoutTokensInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutTokensInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutTokensInputObjectSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputObjectSchema).optional()
}).strict();
export const UserCreateNestedOneWithoutTokensInputObjectSchema: z.ZodType<Prisma.UserCreateNestedOneWithoutTokensInput> = makeSchema() as unknown as z.ZodType<Prisma.UserCreateNestedOneWithoutTokensInput>;
export const UserCreateNestedOneWithoutTokensInputObjectZodSchema = makeSchema();
