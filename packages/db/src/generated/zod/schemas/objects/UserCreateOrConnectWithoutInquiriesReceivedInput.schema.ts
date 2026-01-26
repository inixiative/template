import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './UserWhereUniqueInput.schema';
import { UserCreateWithoutInquiriesReceivedInputObjectSchema as UserCreateWithoutInquiriesReceivedInputObjectSchema } from './UserCreateWithoutInquiriesReceivedInput.schema';
import { UserUncheckedCreateWithoutInquiriesReceivedInputObjectSchema as UserUncheckedCreateWithoutInquiriesReceivedInputObjectSchema } from './UserUncheckedCreateWithoutInquiriesReceivedInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => UserWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => UserCreateWithoutInquiriesReceivedInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutInquiriesReceivedInputObjectSchema)])
}).strict();
export const UserCreateOrConnectWithoutInquiriesReceivedInputObjectSchema: z.ZodType<Prisma.UserCreateOrConnectWithoutInquiriesReceivedInput> = makeSchema() as unknown as z.ZodType<Prisma.UserCreateOrConnectWithoutInquiriesReceivedInput>;
export const UserCreateOrConnectWithoutInquiriesReceivedInputObjectZodSchema = makeSchema();
