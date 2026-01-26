import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserCreateWithoutInquiriesReceivedInputObjectSchema as UserCreateWithoutInquiriesReceivedInputObjectSchema } from './UserCreateWithoutInquiriesReceivedInput.schema';
import { UserUncheckedCreateWithoutInquiriesReceivedInputObjectSchema as UserUncheckedCreateWithoutInquiriesReceivedInputObjectSchema } from './UserUncheckedCreateWithoutInquiriesReceivedInput.schema';
import { UserCreateOrConnectWithoutInquiriesReceivedInputObjectSchema as UserCreateOrConnectWithoutInquiriesReceivedInputObjectSchema } from './UserCreateOrConnectWithoutInquiriesReceivedInput.schema';
import { UserUpsertWithoutInquiriesReceivedInputObjectSchema as UserUpsertWithoutInquiriesReceivedInputObjectSchema } from './UserUpsertWithoutInquiriesReceivedInput.schema';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './UserWhereUniqueInput.schema';
import { UserUpdateToOneWithWhereWithoutInquiriesReceivedInputObjectSchema as UserUpdateToOneWithWhereWithoutInquiriesReceivedInputObjectSchema } from './UserUpdateToOneWithWhereWithoutInquiriesReceivedInput.schema';
import { UserUpdateWithoutInquiriesReceivedInputObjectSchema as UserUpdateWithoutInquiriesReceivedInputObjectSchema } from './UserUpdateWithoutInquiriesReceivedInput.schema';
import { UserUncheckedUpdateWithoutInquiriesReceivedInputObjectSchema as UserUncheckedUpdateWithoutInquiriesReceivedInputObjectSchema } from './UserUncheckedUpdateWithoutInquiriesReceivedInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => UserCreateWithoutInquiriesReceivedInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutInquiriesReceivedInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutInquiriesReceivedInputObjectSchema).optional(),
  upsert: z.lazy(() => UserUpsertWithoutInquiriesReceivedInputObjectSchema).optional(),
  disconnect: z.union([z.boolean(), z.lazy(() => UserWhereInputObjectSchema)]).optional(),
  delete: z.union([z.boolean(), z.lazy(() => UserWhereInputObjectSchema)]).optional(),
  connect: z.lazy(() => UserWhereUniqueInputObjectSchema).optional(),
  update: z.union([z.lazy(() => UserUpdateToOneWithWhereWithoutInquiriesReceivedInputObjectSchema), z.lazy(() => UserUpdateWithoutInquiriesReceivedInputObjectSchema), z.lazy(() => UserUncheckedUpdateWithoutInquiriesReceivedInputObjectSchema)]).optional()
}).strict();
export const UserUpdateOneWithoutInquiriesReceivedNestedInputObjectSchema: z.ZodType<Prisma.UserUpdateOneWithoutInquiriesReceivedNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUpdateOneWithoutInquiriesReceivedNestedInput>;
export const UserUpdateOneWithoutInquiriesReceivedNestedInputObjectZodSchema = makeSchema();
