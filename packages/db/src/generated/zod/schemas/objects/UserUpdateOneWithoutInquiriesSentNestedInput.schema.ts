import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserCreateWithoutInquiriesSentInputObjectSchema as UserCreateWithoutInquiriesSentInputObjectSchema } from './UserCreateWithoutInquiriesSentInput.schema';
import { UserUncheckedCreateWithoutInquiriesSentInputObjectSchema as UserUncheckedCreateWithoutInquiriesSentInputObjectSchema } from './UserUncheckedCreateWithoutInquiriesSentInput.schema';
import { UserCreateOrConnectWithoutInquiriesSentInputObjectSchema as UserCreateOrConnectWithoutInquiriesSentInputObjectSchema } from './UserCreateOrConnectWithoutInquiriesSentInput.schema';
import { UserUpsertWithoutInquiriesSentInputObjectSchema as UserUpsertWithoutInquiriesSentInputObjectSchema } from './UserUpsertWithoutInquiriesSentInput.schema';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './UserWhereUniqueInput.schema';
import { UserUpdateToOneWithWhereWithoutInquiriesSentInputObjectSchema as UserUpdateToOneWithWhereWithoutInquiriesSentInputObjectSchema } from './UserUpdateToOneWithWhereWithoutInquiriesSentInput.schema';
import { UserUpdateWithoutInquiriesSentInputObjectSchema as UserUpdateWithoutInquiriesSentInputObjectSchema } from './UserUpdateWithoutInquiriesSentInput.schema';
import { UserUncheckedUpdateWithoutInquiriesSentInputObjectSchema as UserUncheckedUpdateWithoutInquiriesSentInputObjectSchema } from './UserUncheckedUpdateWithoutInquiriesSentInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => UserCreateWithoutInquiriesSentInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutInquiriesSentInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutInquiriesSentInputObjectSchema).optional(),
  upsert: z.lazy(() => UserUpsertWithoutInquiriesSentInputObjectSchema).optional(),
  disconnect: z.union([z.boolean(), z.lazy(() => UserWhereInputObjectSchema)]).optional(),
  delete: z.union([z.boolean(), z.lazy(() => UserWhereInputObjectSchema)]).optional(),
  connect: z.lazy(() => UserWhereUniqueInputObjectSchema).optional(),
  update: z.union([z.lazy(() => UserUpdateToOneWithWhereWithoutInquiriesSentInputObjectSchema), z.lazy(() => UserUpdateWithoutInquiriesSentInputObjectSchema), z.lazy(() => UserUncheckedUpdateWithoutInquiriesSentInputObjectSchema)]).optional()
}).strict();
export const UserUpdateOneWithoutInquiriesSentNestedInputObjectSchema: z.ZodType<Prisma.UserUpdateOneWithoutInquiriesSentNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUpdateOneWithoutInquiriesSentNestedInput>;
export const UserUpdateOneWithoutInquiriesSentNestedInputObjectZodSchema = makeSchema();
