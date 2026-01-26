import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { UserCreateWithoutInquiriesReceivedInputObjectSchema as UserCreateWithoutInquiriesReceivedInputObjectSchema } from './UserCreateWithoutInquiriesReceivedInput.schema';
import { UserUncheckedCreateWithoutInquiriesReceivedInputObjectSchema as UserUncheckedCreateWithoutInquiriesReceivedInputObjectSchema } from './UserUncheckedCreateWithoutInquiriesReceivedInput.schema';
import { UserCreateOrConnectWithoutInquiriesReceivedInputObjectSchema as UserCreateOrConnectWithoutInquiriesReceivedInputObjectSchema } from './UserCreateOrConnectWithoutInquiriesReceivedInput.schema';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './UserWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => UserCreateWithoutInquiriesReceivedInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutInquiriesReceivedInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutInquiriesReceivedInputObjectSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputObjectSchema).optional()
}).strict();
export const UserCreateNestedOneWithoutInquiriesReceivedInputObjectSchema: z.ZodType<Prisma.UserCreateNestedOneWithoutInquiriesReceivedInput> = makeSchema() as unknown as z.ZodType<Prisma.UserCreateNestedOneWithoutInquiriesReceivedInput>;
export const UserCreateNestedOneWithoutInquiriesReceivedInputObjectZodSchema = makeSchema();
