import * as z from 'zod';
export const WebhookEventGroupByResultSchema = z.array(z.object({
  id: z.string(),
  createdAt: z.date(),
  payload: z.unknown(),
  error: z.string(),
  subscriptionId: z.string(),
  resourceId: z.string(),
  _count: z.object({
    id: z.number(),
    createdAt: z.number(),
    status: z.number(),
    action: z.number(),
    payload: z.number(),
    error: z.number(),
    subscriptionId: z.number(),
    subscription: z.number(),
    resourceId: z.number()
  }).optional(),
  _min: z.object({
    id: z.string().nullable(),
    createdAt: z.date().nullable(),
    error: z.string().nullable(),
    subscriptionId: z.string().nullable(),
    resourceId: z.string().nullable()
  }).nullable().optional(),
  _max: z.object({
    id: z.string().nullable(),
    createdAt: z.date().nullable(),
    error: z.string().nullable(),
    subscriptionId: z.string().nullable(),
    resourceId: z.string().nullable()
  }).nullable().optional()
}));