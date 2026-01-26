import * as z from 'zod';
import type { Prisma } from '../../../client/client';


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
  maxAttempts: z.literal(true).optional(),
  backoffMs: z.literal(true).optional(),
  createdById: z.literal(true).optional()
}).strict();
export const CronJobMaxAggregateInputObjectSchema: z.ZodType<Prisma.CronJobMaxAggregateInputType> = makeSchema() as unknown as z.ZodType<Prisma.CronJobMaxAggregateInputType>;
export const CronJobMaxAggregateInputObjectZodSchema = makeSchema();
