import * as z from 'zod';
export const WebhookSubscriptionDeleteResultSchema = z.nullable(z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  model: z.unknown(),
  url: z.string(),
  secret: z.string().optional(),
  isActive: z.boolean(),
  ownerModel: z.unknown(),
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  user: z.unknown().optional(),
  organization: z.unknown().optional(),
  events: z.array(z.unknown())
}));