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
export const WebhookEventMinOrderByAggregateInputObjectSchema: z.ZodType<Prisma.WebhookEventMinOrderByAggregateInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventMinOrderByAggregateInput>;
export const WebhookEventMinOrderByAggregateInputObjectZodSchema = makeSchema();
