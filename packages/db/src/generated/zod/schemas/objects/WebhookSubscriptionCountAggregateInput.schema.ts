import * as z from 'zod';
import type { Prisma } from '../../../client/client';


const makeSchema = () => z.object({
  id: z.literal(true).optional(),
  createdAt: z.literal(true).optional(),
  updatedAt: z.literal(true).optional(),
  model: z.literal(true).optional(),
  url: z.literal(true).optional(),
  secret: z.literal(true).optional(),
  isActive: z.literal(true).optional(),
  ownerType: z.literal(true).optional(),
  ownerId: z.literal(true).optional(),
  _all: z.literal(true).optional()
}).strict();
export const WebhookSubscriptionCountAggregateInputObjectSchema: z.ZodType<Prisma.WebhookSubscriptionCountAggregateInputType> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionCountAggregateInputType>;
export const WebhookSubscriptionCountAggregateInputObjectZodSchema = makeSchema();
