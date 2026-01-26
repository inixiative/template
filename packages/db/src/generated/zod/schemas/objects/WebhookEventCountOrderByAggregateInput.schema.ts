import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema'

const makeSchema = () => z.object({
  id: SortOrderSchema.optional(),
  createdAt: SortOrderSchema.optional(),
  status: SortOrderSchema.optional(),
  action: SortOrderSchema.optional(),
  payload: SortOrderSchema.optional(),
  error: SortOrderSchema.optional(),
  webhookSubscriptionId: SortOrderSchema.optional(),
  resourceId: SortOrderSchema.optional()
}).strict();
export const WebhookEventCountOrderByAggregateInputObjectSchema: z.ZodType<Prisma.WebhookEventCountOrderByAggregateInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventCountOrderByAggregateInput>;
export const WebhookEventCountOrderByAggregateInputObjectZodSchema = makeSchema();
