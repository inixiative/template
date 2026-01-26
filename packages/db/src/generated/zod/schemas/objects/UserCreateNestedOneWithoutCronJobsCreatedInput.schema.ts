import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserCreateWithoutCronJobsCreatedInputObjectSchema as UserCreateWithoutCronJobsCreatedInputObjectSchema } from './UserCreateWithoutCronJobsCreatedInput.schema';
import { UserUncheckedCreateWithoutCronJobsCreatedInputObjectSchema as UserUncheckedCreateWithoutCronJobsCreatedInputObjectSchema } from './UserUncheckedCreateWithoutCronJobsCreatedInput.schema';
import { UserCreateOrConnectWithoutCronJobsCreatedInputObjectSchema as UserCreateOrConnectWithoutCronJobsCreatedInputObjectSchema } from './UserCreateOrConnectWithoutCronJobsCreatedInput.schema';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './UserWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => UserCreateWithoutCronJobsCreatedInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutCronJobsCreatedInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutCronJobsCreatedInputObjectSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputObjectSchema).optional()
}).strict();
export const UserCreateNestedOneWithoutCronJobsCreatedInputObjectSchema: z.ZodType<Prisma.UserCreateNestedOneWithoutCronJobsCreatedInput> = makeSchema() as unknown as z.ZodType<Prisma.UserCreateNestedOneWithoutCronJobsCreatedInput>;
export const UserCreateNestedOneWithoutCronJobsCreatedInputObjectZodSchema = makeSchema();
