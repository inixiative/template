import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema as SortOrderInputObjectSchema } from './SortOrderInput.schema';
import { WebhookEventOrderByRelationAggregateInputObjectSchema as WebhookEventOrderByRelationAggregateInputObjectSchema } from './WebhookEventOrderByRelationAggregateInput.schema'

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
  events: z.lazy(() => WebhookEventOrderByRelationAggregateInputObjectSchema).optional()
}).strict();
export const WebhookSubscriptionOrderByWithRelationInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionOrderByWithRelationInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionOrderByWithRelationInput>;
export const WebhookSubscriptionOrderByWithRelationInputObjectZodSchema = makeSchema();
