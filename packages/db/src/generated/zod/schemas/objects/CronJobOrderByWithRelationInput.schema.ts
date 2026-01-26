import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema as SortOrderInputObjectSchema } from './SortOrderInput.schema';
import { UserOrderByWithRelationInputObjectSchema as UserOrderByWithRelationInputObjectSchema } from './UserOrderByWithRelationInput.schema'

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
  createdBy: z.lazy(() => UserOrderByWithRelationInputObjectSchema).optional()
}).strict();
export const CronJobOrderByWithRelationInputObjectSchema: z.ZodType<Prisma.CronJobOrderByWithRelationInput> = makeSchema() as unknown as z.ZodType<Prisma.CronJobOrderByWithRelationInput>;
export const CronJobOrderByWithRelationInputObjectZodSchema = makeSchema();
