import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema as SortOrderInputObjectSchema } from './SortOrderInput.schema';
import { WebhookSubscriptionOrderByWithRelationInputObjectSchema as WebhookSubscriptionOrderByWithRelationInputObjectSchema } from './WebhookSubscriptionOrderByWithRelationInput.schema'

const makeSchema = () => z.object({
  id: SortOrderSchema.optional(),
  createdAt: SortOrderSchema.optional(),
  status: SortOrderSchema.optional(),
  action: SortOrderSchema.optional(),
  payload: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  error: z.union([SortOrderSchema, z.lazy(() => SortOrderInputObjectSchema)]).optional(),
  subscriptionId: SortOrderSchema.optional(),
  resourceId: SortOrderSchema.optional(),
  subscription: z.lazy(() => WebhookSubscriptionOrderByWithRelationInputObjectSchema).optional()
}).strict();
export const WebhookEventOrderByWithRelationInputObjectSchema: z.ZodType<Prisma.WebhookEventOrderByWithRelationInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventOrderByWithRelationInput>;
export const WebhookEventOrderByWithRelationInputObjectZodSchema = makeSchema();
