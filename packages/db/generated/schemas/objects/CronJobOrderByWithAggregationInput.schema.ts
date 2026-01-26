import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema as SortOrderInputObjectSchema } from './SortOrderInput.schema';
import { CronJobCountOrderByAggregateInputObjectSchema as CronJobCountOrderByAggregateInputObjectSchema } from './CronJobCountOrderByAggregateInput.schema';
import { CronJobAvgOrderByAggregateInputObjectSchema as CronJobAvgOrderByAggregateInputObjectSchema } from './CronJobAvgOrderByAggregateInput.schema';
import { CronJobMaxOrderByAggregateInputObjectSchema as CronJobMaxOrderByAggregateInputObjectSchema } from './CronJobMaxOrderByAggregateInput.schema';
import { CronJobMinOrderByAggregateInputObjectSchema as CronJobMinOrderByAggregateInputObjectSchema } from './CronJobMinOrderByAggregateInput.schema';
import { CronJobSumOrderByAggregateInputObjectSchema as CronJobSumOrderByAggregateInputObjectSchema } from './CronJobSumOrderByAggregateInput.schema'

const makeSchema = () => z.object({
  id: SortOrderSchema.optional(),
  createdAt: SortOrderSchema.optional(),
  updatedAt: SortOrderSchema.optional(),
  name: SortOrderSchema.optional(),
  jobId: SortOrderSchema.optional(),
  description: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  pattern: SortOrderSchema.optional(),
  enabled: SortOrderSchema.optional(),
  handler: SortOrderSchema.optional(),
  payload: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  maxAttempts: SortOrderSchema.optional(),
  backoffMs: SortOrderSchema.optional(),
  createdById: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  _count: z.lazy(() => CronJobCountOrderByAggregateInputObjectSchema).optional(),
  _avg: z.lazy(() => CronJobAvgOrderByAggregateInputObjectSchema).optional(),
  _max: z.lazy(() => CronJobMaxOrderByAggregateInputObjectSchema).optional(),
  _min: z.lazy(() => CronJobMinOrderByAggregateInputObjectSchema).optional(),
  _sum: z.lazy(() => CronJobSumOrderByAggregateInputObjectSchema).optional()
}).strict();
export const CronJobOrderByWithAggregationInputObjectSchema: z.ZodType<Prisma.CronJobOrderByWithAggregationInput> = makeSchema() as unknown as z.ZodType<Prisma.CronJobOrderByWithAggregationInput>;
export const CronJobOrderByWithAggregationInputObjectZodSchema = makeSchema();
