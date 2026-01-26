import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema'

const makeSchema = () => z.object({
  id: SortOrderSchema.optional(),
  createdAt: SortOrderSchema.optional(),
  updatedAt: SortOrderSchema.optional(),
  name: SortOrderSchema.optional(),
  jobId: SortOrderSchema.optional(),
  description: SortOrderSchema.optional(),
  pattern: SortOrderSchema.optional(),
  enabled: SortOrderSchema.optional(),
  handler: SortOrderSchema.optional(),
  maxAttempts: SortOrderSchema.optional(),
  backoffMs: SortOrderSchema.optional(),
  createdById: SortOrderSchema.optional()
}).strict();
export const CronJobMinOrderByAggregateInputObjectSchema: z.ZodType<Prisma.CronJobMinOrderByAggregateInput> = makeSchema() as unknown as z.ZodType<Prisma.CronJobMinOrderByAggregateInput>;
export const CronJobMinOrderByAggregateInputObjectZodSchema = makeSchema();
