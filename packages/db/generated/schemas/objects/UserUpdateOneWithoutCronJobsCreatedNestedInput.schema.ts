import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { UserCreateWithoutCronJobsCreatedInputObjectSchema as UserCreateWithoutCronJobsCreatedInputObjectSchema } from './UserCreateWithoutCronJobsCreatedInput.schema';
import { UserUncheckedCreateWithoutCronJobsCreatedInputObjectSchema as UserUncheckedCreateWithoutCronJobsCreatedInputObjectSchema } from './UserUncheckedCreateWithoutCronJobsCreatedInput.schema';
import { UserCreateOrConnectWithoutCronJobsCreatedInputObjectSchema as UserCreateOrConnectWithoutCronJobsCreatedInputObjectSchema } from './UserCreateOrConnectWithoutCronJobsCreatedInput.schema';
import { UserUpsertWithoutCronJobsCreatedInputObjectSchema as UserUpsertWithoutCronJobsCreatedInputObjectSchema } from './UserUpsertWithoutCronJobsCreatedInput.schema';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './UserWhereUniqueInput.schema';
import { UserUpdateToOneWithWhereWithoutCronJobsCreatedInputObjectSchema as UserUpdateToOneWithWhereWithoutCronJobsCreatedInputObjectSchema } from './UserUpdateToOneWithWhereWithoutCronJobsCreatedInput.schema';
import { UserUpdateWithoutCronJobsCreatedInputObjectSchema as UserUpdateWithoutCronJobsCreatedInputObjectSchema } from './UserUpdateWithoutCronJobsCreatedInput.schema';
import { UserUncheckedUpdateWithoutCronJobsCreatedInputObjectSchema as UserUncheckedUpdateWithoutCronJobsCreatedInputObjectSchema } from './UserUncheckedUpdateWithoutCronJobsCreatedInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => UserCreateWithoutCronJobsCreatedInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutCronJobsCreatedInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutCronJobsCreatedInputObjectSchema).optional(),
  upsert: z.lazy(() => UserUpsertWithoutCronJobsCreatedInputObjectSchema).optional(),
  disconnect: z.union([z.boolean(), z.lazy(() => UserWhereInputObjectSchema)]).optional(),
  delete: z.union([z.boolean(), z.lazy(() => UserWhereInputObjectSchema)]).optional(),
  connect: z.lazy(() => UserWhereUniqueInputObjectSchema).optional(),
  update: z.union([z.lazy(() => UserUpdateToOneWithWhereWithoutCronJobsCreatedInputObjectSchema), z.lazy(() => UserUpdateWithoutCronJobsCreatedInputObjectSchema), z.lazy(() => UserUncheckedUpdateWithoutCronJobsCreatedInputObjectSchema)]).optional()
}).strict();
export const UserUpdateOneWithoutCronJobsCreatedNestedInputObjectSchema: z.ZodType<Prisma.UserUpdateOneWithoutCronJobsCreatedNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUpdateOneWithoutCronJobsCreatedNestedInput>;
export const UserUpdateOneWithoutCronJobsCreatedNestedInputObjectZodSchema = makeSchema();
