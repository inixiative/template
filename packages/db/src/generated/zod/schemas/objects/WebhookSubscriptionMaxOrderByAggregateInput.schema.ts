import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema'

const makeSchema = () => z.object({
  id: SortOrderSchema.optional(),
  createdAt: SortOrderSchema.optional(),
  updatedAt: SortOrderSchema.optional(),
  model: SortOrderSchema.optional(),
  url: SortOrderSchema.optional(),
  isActive: SortOrderSchema.optional(),
  ownerModel: SortOrderSchema.optional(),
  userId: SortOrderSchema.optional(),
  organizationId: SortOrderSchema.optional()
}).strict();
export const WebhookSubscriptionMaxOrderByAggregateInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionMaxOrderByAggregateInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionMaxOrderByAggregateInput>;
export const WebhookSubscriptionMaxOrderByAggregateInputObjectZodSchema = makeSchema();
