import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './UserWhereUniqueInput.schema';
import { UserCreateWithoutInquiriesSentInputObjectSchema as UserCreateWithoutInquiriesSentInputObjectSchema } from './UserCreateWithoutInquiriesSentInput.schema';
import { UserUncheckedCreateWithoutInquiriesSentInputObjectSchema as UserUncheckedCreateWithoutInquiriesSentInputObjectSchema } from './UserUncheckedCreateWithoutInquiriesSentInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => UserWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => UserCreateWithoutInquiriesSentInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutInquiriesSentInputObjectSchema)])
}).strict();
export const UserCreateOrConnectWithoutInquiriesSentInputObjectSchema: z.ZodType<Prisma.UserCreateOrConnectWithoutInquiriesSentInput> = makeSchema() as unknown as z.ZodType<Prisma.UserCreateOrConnectWithoutInquiriesSentInput>;
export const UserCreateOrConnectWithoutInquiriesSentInputObjectZodSchema = makeSchema();
