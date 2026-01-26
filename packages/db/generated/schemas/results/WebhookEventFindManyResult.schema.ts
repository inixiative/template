import * as z from 'zod';
export const WebhookEventFindManyResultSchema = z.object({
  data: z.array(z.object({
  id: z.string(),
  createdAt: z.date(),
  status: z.unknown(),
  action: z.unknown(),
  payload: z.unknown().optional(),
  error: z.string().optional(),
  webhookSubscriptionId: z.string(),
  webhookSubscription: z.unknown(),
  resourceId: z.string()
})),
  pagination: z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
  hasNext: z.boolean(),
  hasPrev: z.boolean()
})
});