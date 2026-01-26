import * as z from 'zod';
export const WebhookEventAggregateResultSchema = z.object({  _count: z.object({
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
  }).nullable().optional()});