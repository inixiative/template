import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema';
import { UserUpdateWithoutInquiriesReceivedInputObjectSchema as UserUpdateWithoutInquiriesReceivedInputObjectSchema } from './UserUpdateWithoutInquiriesReceivedInput.schema';
import { UserUncheckedUpdateWithoutInquiriesReceivedInputObjectSchema as UserUncheckedUpdateWithoutInquiriesReceivedInputObjectSchema } from './UserUncheckedUpdateWithoutInquiriesReceivedInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => UserWhereInputObjectSchema).optional(),
  data: z.union([z.lazy(() => UserUpdateWithoutInquiriesReceivedInputObjectSchema), z.lazy(() => UserUncheckedUpdateWithoutInquiriesReceivedInputObjectSchema)])
}).strict();
export const UserUpdateToOneWithWhereWithoutInquiriesReceivedInputObjectSchema: z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutInquiriesReceivedInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutInquiriesReceivedInput>;
export const UserUpdateToOneWithWhereWithoutInquiriesReceivedInputObjectZodSchema = makeSchema();
