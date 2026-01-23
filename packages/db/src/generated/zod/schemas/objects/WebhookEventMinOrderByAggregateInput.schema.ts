import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema'

const makeSchema = () => z.object({
  id: SortOrderSchema.optional(),
  createdAt: SortOrderSchema.optional(),
  status: SortOrderSchema.optional(),
  action: SortOrderSchema.optional(),
  error: SortOrderSchema.optional(),
  subscriptionId: SortOrderSchema.optional(),
  resourceId: SortOrderSchema.optional()
}).strict();
export const WebhookEventMinOrderByAggregateInputObjectSchema: z.ZodType<Prisma.WebhookEventMinOrderByAggregateInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventMinOrderByAggregateInput>;
export const WebhookEventMinOrderByAggregateInputObjectZodSchema = makeSchema();
