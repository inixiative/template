import * as z from 'zod';
export const WebhookEventUpsertResultSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  status: z.unknown(),
  action: z.unknown(),
  payload: z.unknown().optional(),
  error: z.string().optional(),
  webhookSubscriptionId: z.string(),
  webhookSubscription: z.unknown(),
  resourceId: z.string()
});