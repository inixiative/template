import { WebhookEventScalarSchema, WebhookSubscriptionScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const webhookSubscriptionReadRoute = readRoute({
  model: Modules.webhookSubscription,
  middleware: [validatePermission('read')],
  responseSchema: WebhookSubscriptionScalarSchema.extend({
    webhookEvents: WebhookEventScalarSchema.array(),
  }),
});
