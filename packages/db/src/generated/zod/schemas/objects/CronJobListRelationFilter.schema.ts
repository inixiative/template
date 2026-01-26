import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { CronJobWhereInputObjectSchema as CronJobWhereInputObjectSchema } from './CronJobWhereInput.schema'

const makeSchema = () => z.object({
  every: z.lazy(() => CronJobWhereInputObjectSchema).optional(),
  some: z.lazy(() => CronJobWhereInputObjectSchema).optional(),
  none: z.lazy(() => CronJobWhereInputObjectSchema).optional()
}).strict();
export const CronJobListRelationFilterObjectSchema: z.ZodType<Prisma.CronJobListRelationFilter> = makeSchema() as unknown as z.ZodType<Prisma.CronJobListRelationFilter>;
export const CronJobListRelationFilterObjectZodSchema = makeSchema();
