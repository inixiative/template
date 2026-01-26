import * as z from 'zod';
import type { Prisma } from '../../../client/client';


const makeSchema = () => z.object({
  id: z.literal(true).optional(),
  createdAt: z.literal(true).optional(),
  status: z.literal(true).optional(),
  action: z.literal(true).optional(),
  error: z.literal(true).optional(),
  webhookSubscriptionId: z.literal(true).optional(),
  resourceId: z.literal(true).optional()
}).strict();
export const WebhookEventMaxAggregateInputObjectSchema: z.ZodType<Prisma.WebhookEventMaxAggregateInputType> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventMaxAggregateInputType>;
export const WebhookEventMaxAggregateInputObjectZodSchema = makeSchema();
