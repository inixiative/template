import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { CronJobWhereUniqueInputObjectSchema as CronJobWhereUniqueInputObjectSchema } from './CronJobWhereUniqueInput.schema';
import { CronJobCreateWithoutCreatedByInputObjectSchema as CronJobCreateWithoutCreatedByInputObjectSchema } from './CronJobCreateWithoutCreatedByInput.schema';
import { CronJobUncheckedCreateWithoutCreatedByInputObjectSchema as CronJobUncheckedCreateWithoutCreatedByInputObjectSchema } from './CronJobUncheckedCreateWithoutCreatedByInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => CronJobWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => CronJobCreateWithoutCreatedByInputObjectSchema), z.lazy(() => CronJobUncheckedCreateWithoutCreatedByInputObjectSchema)])
}).strict();
export const CronJobCreateOrConnectWithoutCreatedByInputObjectSchema: z.ZodType<Prisma.CronJobCreateOrConnectWithoutCreatedByInput> = makeSchema() as unknown as z.ZodType<Prisma.CronJobCreateOrConnectWithoutCreatedByInput>;
export const CronJobCreateOrConnectWithoutCreatedByInputObjectZodSchema = makeSchema();
