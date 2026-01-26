import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { CronJobWhereInputObjectSchema as CronJobWhereInputObjectSchema } from './CronJobWhereInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => CronJobWhereInputObjectSchema).optional()
}).strict();
export const UserCountOutputTypeCountCronJobsCreatedArgsObjectSchema = makeSchema();
export const UserCountOutputTypeCountCronJobsCreatedArgsObjectZodSchema = makeSchema();
