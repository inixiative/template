import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './UserWhereUniqueInput.schema';
import { UserCreateWithoutTokensInputObjectSchema as UserCreateWithoutTokensInputObjectSchema } from './UserCreateWithoutTokensInput.schema';
import { UserUncheckedCreateWithoutTokensInputObjectSchema as UserUncheckedCreateWithoutTokensInputObjectSchema } from './UserUncheckedCreateWithoutTokensInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => UserWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => UserCreateWithoutTokensInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutTokensInputObjectSchema)])
}).strict();
export const UserCreateOrConnectWithoutTokensInputObjectSchema: z.ZodType<Prisma.UserCreateOrConnectWithoutTokensInput> = makeSchema() as unknown as z.ZodType<Prisma.UserCreateOrConnectWithoutTokensInput>;
export const UserCreateOrConnectWithoutTokensInputObjectZodSchema = makeSchema();
