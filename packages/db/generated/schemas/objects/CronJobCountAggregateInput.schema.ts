import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';


const makeSchema = () => z.object({
  id: z.literal(true).optional(),
  createdAt: z.literal(true).optional(),
  updatedAt: z.literal(true).optional(),
  name: z.literal(true).optional(),
  jobId: z.literal(true).optional(),
  description: z.literal(true).optional(),
  pattern: z.literal(true).optional(),
  enabled: z.literal(true).optional(),
  handler: z.literal(true).optional(),
  payload: z.literal(true).optional(),
  maxAttempts: z.literal(true).optional(),
  backoffMs: z.literal(true).optional(),
  createdById: z.literal(true).optional(),
  _all: z.literal(true).optional()
}).strict();
export const CronJobCountAggregateInputObjectSchema: z.ZodType<Prisma.CronJobCountAggregateInputType> = makeSchema() as unknown as z.ZodType<Prisma.CronJobCountAggregateInputType>;
export const CronJobCountAggregateInputObjectZodSchema = makeSchema();
