import * as z from 'zod';
export const WebhookEventGroupByResultSchema = z.array(z.object({
  id: z.string(),
  createdAt: z.date(),
  payload: z.unknown(),
  error: z.string(),
  webhookSubscriptionId: z.string(),
  resourceId: z.string(),
  _count: z.object({
    id: z.number(),
    createdAt: z.number(),
    status: z.number(),
    action: z.number(),
    payload: z.number(),
    error: z.number(),
    webhookSubscriptionId: z.number(),
    webhookSubscription: z.number(),
    resourceId: z.number()
  }).optional(),
  _min: z.object({
    id: z.string().nullable(),
    createdAt: z.date().nullable(),
    error: z.string().nullable(),
    webhookSubscriptionId: z.string().nullable(),
    resourceId: z.string().nullable()
  }).nullable().optional(),
  _max: z.object({
    id: z.string().nullable(),
    createdAt: z.date().nullable(),
    error: z.string().nullable(),
    webhookSubscriptionId: z.string().nullable(),
    resourceId: z.string().nullable()
  }).nullable().optional()
}));