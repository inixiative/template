import * as z from 'zod';
export const WebhookSubscriptionCreateResultSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  model: z.unknown(),
  url: z.string(),
  isActive: z.boolean(),
  ownerModel: z.unknown(),
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  user: z.unknown().optional(),
  organization: z.unknown().optional(),
  webhookEvents: z.array(z.unknown())
});