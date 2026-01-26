import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { CronJobWhereUniqueInputObjectSchema as CronJobWhereUniqueInputObjectSchema } from './CronJobWhereUniqueInput.schema';
import { CronJobUpdateWithoutCreatedByInputObjectSchema as CronJobUpdateWithoutCreatedByInputObjectSchema } from './CronJobUpdateWithoutCreatedByInput.schema';
import { CronJobUncheckedUpdateWithoutCreatedByInputObjectSchema as CronJobUncheckedUpdateWithoutCreatedByInputObjectSchema } from './CronJobUncheckedUpdateWithoutCreatedByInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => CronJobWhereUniqueInputObjectSchema),
  data: z.union([z.lazy(() => CronJobUpdateWithoutCreatedByInputObjectSchema), z.lazy(() => CronJobUncheckedUpdateWithoutCreatedByInputObjectSchema)])
}).strict();
export const CronJobUpdateWithWhereUniqueWithoutCreatedByInputObjectSchema: z.ZodType<Prisma.CronJobUpdateWithWhereUniqueWithoutCreatedByInput> = makeSchema() as unknown as z.ZodType<Prisma.CronJobUpdateWithWhereUniqueWithoutCreatedByInput>;
export const CronJobUpdateWithWhereUniqueWithoutCreatedByInputObjectZodSchema = makeSchema();
