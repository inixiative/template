import { WebhookSubscriptionScalarInputSchema, WebhookSubscriptionScalarSchema } from '@template/db';
import { z } from 'zod';
import { validateWebhookUrl } from '#/lib/webhooks/validators/validateWebhookUrl';

export const webhookUrlSchema = z.string().superRefine((url, ctx) => {
  try {
    validateWebhookUrl(url);
  } catch (error) {
    ctx.addIssue({ code: 'custom', message: error instanceof Error ? error.message : 'Invalid webhook URL' });
  }
});

export const webhookSubscriptionCreateBodySchema = WebhookSubscriptionScalarInputSchema.pick({
  model: true,
  url: true,
}).extend({ url: webhookUrlSchema });

export const webhookSubscriptionReadResponseSchema = WebhookSubscriptionScalarSchema;
