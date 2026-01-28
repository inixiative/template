import * as z from 'zod';
export const WebhookSubscriptionGroupByResultSchema = z.array(z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  url: z.string(),
  isActive: z.boolean(),
  userId: z.string(),
  organizationId: z.string(),
  _count: z.object({
    id: z.number(),
    createdAt: z.number(),
    updatedAt: z.number(),
    model: z.number(),
    url: z.number(),
    isActive: z.number(),
    ownerModel: z.number(),
    userId: z.number(),
    organizationId: z.number(),
    user: z.number(),
    organization: z.number(),
    webhookEvents: z.number()
  }).optional(),
  _min: z.object({
    id: z.string().nullable(),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable(),
    url: z.string().nullable(),
    userId: z.string().nullable(),
    organizationId: z.string().nullable()
  }).nullable().optional(),
  _max: z.object({
    id: z.string().nullable(),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable(),
    url: z.string().nullable(),
    userId: z.string().nullable(),
    organizationId: z.string().nullable()
  }).nullable().optional()
}));