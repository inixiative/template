import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { UserUpdateWithoutInquiriesReceivedInputObjectSchema as UserUpdateWithoutInquiriesReceivedInputObjectSchema } from './UserUpdateWithoutInquiriesReceivedInput.schema';
import { UserUncheckedUpdateWithoutInquiriesReceivedInputObjectSchema as UserUncheckedUpdateWithoutInquiriesReceivedInputObjectSchema } from './UserUncheckedUpdateWithoutInquiriesReceivedInput.schema';
import { UserCreateWithoutInquiriesReceivedInputObjectSchema as UserCreateWithoutInquiriesReceivedInputObjectSchema } from './UserCreateWithoutInquiriesReceivedInput.schema';
import { UserUncheckedCreateWithoutInquiriesReceivedInputObjectSchema as UserUncheckedCreateWithoutInquiriesReceivedInputObjectSchema } from './UserUncheckedCreateWithoutInquiriesReceivedInput.schema';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema'

const makeSchema = () => z.object({
  update: z.union([z.lazy(() => UserUpdateWithoutInquiriesReceivedInputObjectSchema), z.lazy(() => UserUncheckedUpdateWithoutInquiriesReceivedInputObjectSchema)]),
  create: z.union([z.lazy(() => UserCreateWithoutInquiriesReceivedInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutInquiriesReceivedInputObjectSchema)]),
  where: z.lazy(() => UserWhereInputObjectSchema).optional()
}).strict();
export const UserUpsertWithoutInquiriesReceivedInputObjectSchema: z.ZodType<Prisma.UserUpsertWithoutInquiriesReceivedInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUpsertWithoutInquiriesReceivedInput>;
export const UserUpsertWithoutInquiriesReceivedInputObjectZodSchema = makeSchema();
