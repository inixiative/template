import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './UserWhereUniqueInput.schema';
import { UserCreateWithoutCronJobsCreatedInputObjectSchema as UserCreateWithoutCronJobsCreatedInputObjectSchema } from './UserCreateWithoutCronJobsCreatedInput.schema';
import { UserUncheckedCreateWithoutCronJobsCreatedInputObjectSchema as UserUncheckedCreateWithoutCronJobsCreatedInputObjectSchema } from './UserUncheckedCreateWithoutCronJobsCreatedInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => UserWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => UserCreateWithoutCronJobsCreatedInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutCronJobsCreatedInputObjectSchema)])
}).strict();
export const UserCreateOrConnectWithoutCronJobsCreatedInputObjectSchema: z.ZodType<Prisma.UserCreateOrConnectWithoutCronJobsCreatedInput> = makeSchema() as unknown as z.ZodType<Prisma.UserCreateOrConnectWithoutCronJobsCreatedInput>;
export const UserCreateOrConnectWithoutCronJobsCreatedInputObjectZodSchema = makeSchema();
