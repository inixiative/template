import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema'

const makeSchema = () => z.object({
  _count: SortOrderSchema.optional()
}).strict();
export const CronJobOrderByRelationAggregateInputObjectSchema: z.ZodType<Prisma.CronJobOrderByRelationAggregateInput> = makeSchema() as unknown as z.ZodType<Prisma.CronJobOrderByRelationAggregateInput>;
export const CronJobOrderByRelationAggregateInputObjectZodSchema = makeSchema();
