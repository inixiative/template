import * as z from 'zod';
export const WebhookSubscriptionAggregateResultSchema = z.object({  _count: z.object({
    id: z.number(),
    createdAt: z.number(),
    updatedAt: z.number(),
    model: z.number(),
    url: z.number(),
    secret: z.number(),
    isActive: z.number(),
    ownerModel: z.number(),
    userId: z.number(),
    organizationId: z.number(),
    user: z.number(),
    organization: z.number(),
    events: z.number()
  }).optional(),
  _min: z.object({
    id: z.string().nullable(),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable(),
    url: z.string().nullable(),
    secret: z.string().nullable(),
    userId: z.string().nullable(),
    organizationId: z.string().nullable()
  }).nullable().optional(),
  _max: z.object({
    id: z.string().nullable(),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable(),
    url: z.string().nullable(),
    secret: z.string().nullable(),
    userId: z.string().nullable(),
    organizationId: z.string().nullable()
  }).nullable().optional()});