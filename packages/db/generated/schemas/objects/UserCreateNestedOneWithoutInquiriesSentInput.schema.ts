import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { UserCreateWithoutInquiriesSentInputObjectSchema as UserCreateWithoutInquiriesSentInputObjectSchema } from './UserCreateWithoutInquiriesSentInput.schema';
import { UserUncheckedCreateWithoutInquiriesSentInputObjectSchema as UserUncheckedCreateWithoutInquiriesSentInputObjectSchema } from './UserUncheckedCreateWithoutInquiriesSentInput.schema';
import { UserCreateOrConnectWithoutInquiriesSentInputObjectSchema as UserCreateOrConnectWithoutInquiriesSentInputObjectSchema } from './UserCreateOrConnectWithoutInquiriesSentInput.schema';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './UserWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => UserCreateWithoutInquiriesSentInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutInquiriesSentInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutInquiriesSentInputObjectSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputObjectSchema).optional()
}).strict();
export const UserCreateNestedOneWithoutInquiriesSentInputObjectSchema: z.ZodType<Prisma.UserCreateNestedOneWithoutInquiriesSentInput> = makeSchema() as unknown as z.ZodType<Prisma.UserCreateNestedOneWithoutInquiriesSentInput>;
export const UserCreateNestedOneWithoutInquiriesSentInputObjectZodSchema = makeSchema();
