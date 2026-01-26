import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema';
import { UserUpdateWithoutInquiriesSentInputObjectSchema as UserUpdateWithoutInquiriesSentInputObjectSchema } from './UserUpdateWithoutInquiriesSentInput.schema';
import { UserUncheckedUpdateWithoutInquiriesSentInputObjectSchema as UserUncheckedUpdateWithoutInquiriesSentInputObjectSchema } from './UserUncheckedUpdateWithoutInquiriesSentInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => UserWhereInputObjectSchema).optional(),
  data: z.union([z.lazy(() => UserUpdateWithoutInquiriesSentInputObjectSchema), z.lazy(() => UserUncheckedUpdateWithoutInquiriesSentInputObjectSchema)])
}).strict();
export const UserUpdateToOneWithWhereWithoutInquiriesSentInputObjectSchema: z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutInquiriesSentInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutInquiriesSentInput>;
export const UserUpdateToOneWithWhereWithoutInquiriesSentInputObjectZodSchema = makeSchema();
