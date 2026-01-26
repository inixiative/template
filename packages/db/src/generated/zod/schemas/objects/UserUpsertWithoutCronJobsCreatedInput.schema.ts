import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserUpdateWithoutCronJobsCreatedInputObjectSchema as UserUpdateWithoutCronJobsCreatedInputObjectSchema } from './UserUpdateWithoutCronJobsCreatedInput.schema';
import { UserUncheckedUpdateWithoutCronJobsCreatedInputObjectSchema as UserUncheckedUpdateWithoutCronJobsCreatedInputObjectSchema } from './UserUncheckedUpdateWithoutCronJobsCreatedInput.schema';
import { UserCreateWithoutCronJobsCreatedInputObjectSchema as UserCreateWithoutCronJobsCreatedInputObjectSchema } from './UserCreateWithoutCronJobsCreatedInput.schema';
import { UserUncheckedCreateWithoutCronJobsCreatedInputObjectSchema as UserUncheckedCreateWithoutCronJobsCreatedInputObjectSchema } from './UserUncheckedCreateWithoutCronJobsCreatedInput.schema';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema'

const makeSchema = () => z.object({
  update: z.union([z.lazy(() => UserUpdateWithoutCronJobsCreatedInputObjectSchema), z.lazy(() => UserUncheckedUpdateWithoutCronJobsCreatedInputObjectSchema)]),
  create: z.union([z.lazy(() => UserCreateWithoutCronJobsCreatedInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutCronJobsCreatedInputObjectSchema)]),
  where: z.lazy(() => UserWhereInputObjectSchema).optional()
}).strict();
export const UserUpsertWithoutCronJobsCreatedInputObjectSchema: z.ZodType<Prisma.UserUpsertWithoutCronJobsCreatedInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUpsertWithoutCronJobsCreatedInput>;
export const UserUpsertWithoutCronJobsCreatedInputObjectZodSchema = makeSchema();
