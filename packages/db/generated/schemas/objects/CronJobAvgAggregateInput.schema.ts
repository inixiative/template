import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';


const makeSchema = () => z.object({
  maxAttempts: z.literal(true).optional(),
  backoffMs: z.literal(true).optional()
}).strict();
export const CronJobAvgAggregateInputObjectSchema: z.ZodType<Prisma.CronJobAvgAggregateInputType> = makeSchema() as unknown as z.ZodType<Prisma.CronJobAvgAggregateInputType>;
export const CronJobAvgAggregateInputObjectZodSchema = makeSchema();
