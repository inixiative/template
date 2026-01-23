import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema as SortOrderInputObjectSchema } from './SortOrderInput.schema';
import { WebhookSubscriptionCountOrderByAggregateInputObjectSchema as WebhookSubscriptionCountOrderByAggregateInputObjectSchema } from './WebhookSubscriptionCountOrderByAggregateInput.schema';
import { WebhookSubscriptionMaxOrderByAggregateInputObjectSchema as WebhookSubscriptionMaxOrderByAggregateInputObjectSchema } from './WebhookSubscriptionMaxOrderByAggregateInput.schema';
import { WebhookSubscriptionMinOrderByAggregateInputObjectSchema as WebhookSubscriptionMinOrderByAggregateInputObjectSchema } from './WebhookSubscriptionMinOrderByAggregateInput.schema'

const makeSchema = () => z.object({
  id: SortOrderSchema.optional(),
  createdAt: SortOrderSchema.optional(),
  updatedAt: SortOrderSchema.optional(),
  model: SortOrderSchema.optional(),
  url: SortOrderSchema.optional(),
  secret: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  isActive: SortOrderSchema.optional(),
  ownerType: SortOrderSchema.optional(),
  ownerId: SortOrderSchema.optional(),
  _count: z.lazy(() => WebhookSubscriptionCountOrderByAggregateInputObjectSchema).optional(),
  _max: z.lazy(() => WebhookSubscriptionMaxOrderByAggregateInputObjectSchema).optional(),
  _min: z.lazy(() => WebhookSubscriptionMinOrderByAggregateInputObjectSchema).optional()
}).strict();
export const WebhookSubscriptionOrderByWithAggregationInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionOrderByWithAggregationInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionOrderByWithAggregationInput>;
export const WebhookSubscriptionOrderByWithAggregationInputObjectZodSchema = makeSchema();
