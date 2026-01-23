import * as z from 'zod';
export const WebhookEventUpsertResultSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  status: z.unknown(),
  action: z.unknown(),
  payload: z.unknown().optional(),
  error: z.string().optional(),
  subscriptionId: z.string(),
  subscription: z.unknown(),
  resourceId: z.string()
});