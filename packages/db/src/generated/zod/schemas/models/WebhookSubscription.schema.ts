import * as z from 'zod';
import { WebhookModelSchema } from '../enums/WebhookModel.schema';
import { WebhookOwnerModelSchema } from '../enums/WebhookOwnerModel.schema';

export const WebhookSubscriptionSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  model: WebhookModelSchema,
  url: z.string(),
  secret: z.string().nullish(),
  isActive: z.boolean().default(true),
  ownerModel: WebhookOwnerModelSchema,
  userId: z.string().nullish(),
  organizationId: z.string().nullish(),
});

export type WebhookSubscriptionType = z.infer<typeof WebhookSubscriptionSchema>;
