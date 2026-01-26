import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserUpdateWithoutInquiriesSentInputObjectSchema as UserUpdateWithoutInquiriesSentInputObjectSchema } from './UserUpdateWithoutInquiriesSentInput.schema';
import { UserUncheckedUpdateWithoutInquiriesSentInputObjectSchema as UserUncheckedUpdateWithoutInquiriesSentInputObjectSchema } from './UserUncheckedUpdateWithoutInquiriesSentInput.schema';
import { UserCreateWithoutInquiriesSentInputObjectSchema as UserCreateWithoutInquiriesSentInputObjectSchema } from './UserCreateWithoutInquiriesSentInput.schema';
import { UserUncheckedCreateWithoutInquiriesSentInputObjectSchema as UserUncheckedCreateWithoutInquiriesSentInputObjectSchema } from './UserUncheckedCreateWithoutInquiriesSentInput.schema';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema'

const makeSchema = () => z.object({
  update: z.union([z.lazy(() => UserUpdateWithoutInquiriesSentInputObjectSchema), z.lazy(() => UserUncheckedUpdateWithoutInquiriesSentInputObjectSchema)]),
  create: z.union([z.lazy(() => UserCreateWithoutInquiriesSentInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutInquiriesSentInputObjectSchema)]),
  where: z.lazy(() => UserWhereInputObjectSchema).optional()
}).strict();
export const UserUpsertWithoutInquiriesSentInputObjectSchema: z.ZodType<Prisma.UserUpsertWithoutInquiriesSentInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUpsertWithoutInquiriesSentInput>;
export const UserUpsertWithoutInquiriesSentInputObjectZodSchema = makeSchema();
