import * as z from 'zod';
export const WebhookSubscriptionGroupByResultSchema = z.array(z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  url: z.string(),
  secret: z.string(),
  isActive: z.boolean(),
  ownerId: z.string(),
  _count: z.object({
    id: z.number(),
    createdAt: z.number(),
    updatedAt: z.number(),
    model: z.number(),
    url: z.number(),
    secret: z.number(),
    isActive: z.number(),
    ownerType: z.number(),
    ownerId: z.number(),
    events: z.number()
  }).optional(),
  _min: z.object({
    id: z.string().nullable(),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable(),
    url: z.string().nullable(),
    secret: z.string().nullable(),
    ownerId: z.string().nullable()
  }).nullable().optional(),
  _max: z.object({
    id: z.string().nullable(),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable(),
    url: z.string().nullable(),
    secret: z.string().nullable(),
    ownerId: z.string().nullable()
  }).nullable().optional()
}));