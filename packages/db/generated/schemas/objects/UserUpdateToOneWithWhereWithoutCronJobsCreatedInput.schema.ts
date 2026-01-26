import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema';
import { UserUpdateWithoutCronJobsCreatedInputObjectSchema as UserUpdateWithoutCronJobsCreatedInputObjectSchema } from './UserUpdateWithoutCronJobsCreatedInput.schema';
import { UserUncheckedUpdateWithoutCronJobsCreatedInputObjectSchema as UserUncheckedUpdateWithoutCronJobsCreatedInputObjectSchema } from './UserUncheckedUpdateWithoutCronJobsCreatedInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => UserWhereInputObjectSchema).optional(),
  data: z.union([z.lazy(() => UserUpdateWithoutCronJobsCreatedInputObjectSchema), z.lazy(() => UserUncheckedUpdateWithoutCronJobsCreatedInputObjectSchema)])
}).strict();
export const UserUpdateToOneWithWhereWithoutCronJobsCreatedInputObjectSchema: z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutCronJobsCreatedInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutCronJobsCreatedInput>;
export const UserUpdateToOneWithWhereWithoutCronJobsCreatedInputObjectZodSchema = makeSchema();
