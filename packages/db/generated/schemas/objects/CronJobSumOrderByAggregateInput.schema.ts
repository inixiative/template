import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema'

const makeSchema = () => z.object({
  maxAttempts: SortOrderSchema.optional(),
  backoffMs: SortOrderSchema.optional()
}).strict();
export const CronJobSumOrderByAggregateInputObjectSchema: z.ZodType<Prisma.CronJobSumOrderByAggregateInput> = makeSchema() as unknown as z.ZodType<Prisma.CronJobSumOrderByAggregateInput>;
export const CronJobSumOrderByAggregateInputObjectZodSchema = makeSchema();
