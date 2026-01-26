import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema as SortOrderInputObjectSchema } from './SortOrderInput.schema';
import { WebhookEventCountOrderByAggregateInputObjectSchema as WebhookEventCountOrderByAggregateInputObjectSchema } from './WebhookEventCountOrderByAggregateInput.schema';
import { WebhookEventMaxOrderByAggregateInputObjectSchema as WebhookEventMaxOrderByAggregateInputObjectSchema } from './WebhookEventMaxOrderByAggregateInput.schema';
import { WebhookEventMinOrderByAggregateInputObjectSchema as WebhookEventMinOrderByAggregateInputObjectSchema } from './WebhookEventMinOrderByAggregateInput.schema'

const makeSchema = () => z.object({
  id: SortOrderSchema.optional(),
  createdAt: SortOrderSchema.optional(),
  status: SortOrderSchema.optional(),
  action: SortOrderSchema.optional(),
  payload: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  error: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  webhookSubscriptionId: SortOrderSchema.optional(),
  resourceId: SortOrderSchema.optional(),
  _count: z.lazy(() => WebhookEventCountOrderByAggregateInputObjectSchema).optional(),
  _max: z.lazy(() => WebhookEventMaxOrderByAggregateInputObjectSchema).optional(),
  _min: z.lazy(() => WebhookEventMinOrderByAggregateInputObjectSchema).optional()
}).strict();
export const WebhookEventOrderByWithAggregationInputObjectSchema: z.ZodType<Prisma.WebhookEventOrderByWithAggregationInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventOrderByWithAggregationInput>;
export const WebhookEventOrderByWithAggregationInputObjectZodSchema = makeSchema();
