import * as z from 'zod';
export const WebhookSubscriptionFindFirstResultSchema = z.nullable(z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  model: z.unknown(),
  url: z.string(),
  secret: z.string().optional(),
  isActive: z.boolean(),
  ownerType: z.unknown(),
  ownerId: z.string(),
  events: z.array(z.unknown())
}));