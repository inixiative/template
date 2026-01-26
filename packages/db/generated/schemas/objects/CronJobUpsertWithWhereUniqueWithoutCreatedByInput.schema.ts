import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { CronJobWhereUniqueInputObjectSchema as CronJobWhereUniqueInputObjectSchema } from './CronJobWhereUniqueInput.schema';
import { CronJobUpdateWithoutCreatedByInputObjectSchema as CronJobUpdateWithoutCreatedByInputObjectSchema } from './CronJobUpdateWithoutCreatedByInput.schema';
import { CronJobUncheckedUpdateWithoutCreatedByInputObjectSchema as CronJobUncheckedUpdateWithoutCreatedByInputObjectSchema } from './CronJobUncheckedUpdateWithoutCreatedByInput.schema';
import { CronJobCreateWithoutCreatedByInputObjectSchema as CronJobCreateWithoutCreatedByInputObjectSchema } from './CronJobCreateWithoutCreatedByInput.schema';
import { CronJobUncheckedCreateWithoutCreatedByInputObjectSchema as CronJobUncheckedCreateWithoutCreatedByInputObjectSchema } from './CronJobUncheckedCreateWithoutCreatedByInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => CronJobWhereUniqueInputObjectSchema),
  update: z.union([z.lazy(() => CronJobUpdateWithoutCreatedByInputObjectSchema), z.lazy(() => CronJobUncheckedUpdateWithoutCreatedByInputObjectSchema)]),
  create: z.union([z.lazy(() => CronJobCreateWithoutCreatedByInputObjectSchema), z.lazy(() => CronJobUncheckedCreateWithoutCreatedByInputObjectSchema)])
}).strict();
export const CronJobUpsertWithWhereUniqueWithoutCreatedByInputObjectSchema: z.ZodType<Prisma.CronJobUpsertWithWhereUniqueWithoutCreatedByInput> = makeSchema() as unknown as z.ZodType<Prisma.CronJobUpsertWithWhereUniqueWithoutCreatedByInput>;
export const CronJobUpsertWithWhereUniqueWithoutCreatedByInputObjectZodSchema = makeSchema();
