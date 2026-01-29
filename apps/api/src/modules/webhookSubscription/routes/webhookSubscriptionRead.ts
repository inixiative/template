import { WebhookEventScalarSchema, WebhookSubscriptionScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { validateOwnerPermission } from '#/middleware/validations/validateOwnerPermission';
import { Modules } from '#/modules/modules';

export const webhookSubscriptionReadRoute = readRoute({
  model: Modules.webhookSubscription,
  middleware: [validateOwnerPermission({ action: 'read' })],
  responseSchema: WebhookSubscriptionScalarSchema.extend({
    webhookEvents: WebhookEventScalarSchema.array(),
  }),
});
