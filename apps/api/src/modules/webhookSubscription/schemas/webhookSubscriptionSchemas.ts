import { WebhookSubscriptionScalarInputSchema, WebhookSubscriptionScalarSchema } from '@template/db';
import { z } from 'zod';
import { validateWebhookUrl } from '#/lib/webhooks/validateWebhookUrl';

export const webhookUrlSchema = z.string().superRefine((url, ctx) => {
  const error = validateWebhookUrl(url);
  if (error) ctx.addIssue({ code: 'custom', message: `Webhook URL ${error}` });
});

export const webhookSubscriptionCreateBodySchema = WebhookSubscriptionScalarInputSchema.pick({
  model: true,
  url: true,
}).extend({ url: webhookUrlSchema });

export const webhookSubscriptionReadResponseSchema = WebhookSubscriptionScalarSchema;
