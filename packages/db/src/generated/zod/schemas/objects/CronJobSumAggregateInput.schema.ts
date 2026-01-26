import * as z from 'zod';
import type { Prisma } from '../../../client/client';


const makeSchema = () => z.object({
  maxAttempts: z.literal(true).optional(),
  backoffMs: z.literal(true).optional()
}).strict();
export const CronJobSumAggregateInputObjectSchema: z.ZodType<Prisma.CronJobSumAggregateInputType> = makeSchema() as unknown as z.ZodType<Prisma.CronJobSumAggregateInputType>;
export const CronJobSumAggregateInputObjectZodSchema = makeSchema();
