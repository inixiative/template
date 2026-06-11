/**
 * @atlas
 * @kind schema
 * @partOf feature:webhooks
 * @uses none
 */
import { WebhookSubscriptionScalarInputSchema, WebhookSubscriptionScalarSchema } from '@template/db';

export const webhookSubscriptionCreateBodySchema = WebhookSubscriptionScalarInputSchema.pick({
  model: true,
  url: true,
});

export const webhookSubscriptionReadResponseSchema = WebhookSubscriptionScalarSchema;
