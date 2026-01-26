import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema'

const makeSchema = () => z.object({
  id: SortOrderSchema.optional(),
  createdAt: SortOrderSchema.optional(),
  status: SortOrderSchema.optional(),
  action: SortOrderSchema.optional(),
  error: SortOrderSchema.optional(),
  webhookSubscriptionId: SortOrderSchema.optional(),
  resourceId: SortOrderSchema.optional()
}).strict();
export const WebhookEventMaxOrderByAggregateInputObjectSchema: z.ZodType<Prisma.WebhookEventMaxOrderByAggregateInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventMaxOrderByAggregateInput>;
export const WebhookEventMaxOrderByAggregateInputObjectZodSchema = makeSchema();
