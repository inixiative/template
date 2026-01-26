import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';


const makeSchema = () => z.object({
  id: z.literal(true).optional(),
  createdAt: z.literal(true).optional(),
  status: z.literal(true).optional(),
  action: z.literal(true).optional(),
  error: z.literal(true).optional(),
  webhookSubscriptionId: z.literal(true).optional(),
  resourceId: z.literal(true).optional()
}).strict();
export const WebhookEventMinAggregateInputObjectSchema: z.ZodType<Prisma.WebhookEventMinAggregateInputType> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventMinAggregateInputType>;
export const WebhookEventMinAggregateInputObjectZodSchema = makeSchema();
