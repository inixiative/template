import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { CronJobScalarWhereInputObjectSchema as CronJobScalarWhereInputObjectSchema } from './CronJobScalarWhereInput.schema';
import { CronJobUpdateManyMutationInputObjectSchema as CronJobUpdateManyMutationInputObjectSchema } from './CronJobUpdateManyMutationInput.schema';
import { CronJobUncheckedUpdateManyWithoutCreatedByInputObjectSchema as CronJobUncheckedUpdateManyWithoutCreatedByInputObjectSchema } from './CronJobUncheckedUpdateManyWithoutCreatedByInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => CronJobScalarWhereInputObjectSchema),
  data: z.union([z.lazy(() => CronJobUpdateManyMutationInputObjectSchema), z.lazy(() => CronJobUncheckedUpdateManyWithoutCreatedByInputObjectSchema)])
}).strict();
export const CronJobUpdateManyWithWhereWithoutCreatedByInputObjectSchema: z.ZodType<Prisma.CronJobUpdateManyWithWhereWithoutCreatedByInput> = makeSchema() as unknown as z.ZodType<Prisma.CronJobUpdateManyWithWhereWithoutCreatedByInput>;
export const CronJobUpdateManyWithWhereWithoutCreatedByInputObjectZodSchema = makeSchema();
