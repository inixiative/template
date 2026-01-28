import { WebhookSubscriptionScalarSchema } from '@template/db';

export const webhookSubscriptionCreateBodySchema = WebhookSubscriptionScalarSchema.pick({
  model: true,
  url: true,
});

export const webhookSubscriptionReadResponseSchema = WebhookSubscriptionScalarSchema;
