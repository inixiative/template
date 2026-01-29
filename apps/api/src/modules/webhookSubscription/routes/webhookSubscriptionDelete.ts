import { WebhookSubscriptionScalarSchema } from '@template/db';
import { deleteRoute } from '#/lib/routeTemplates';
import { validateOwnerPermission } from '#/middleware/validations/validateOwnerPermission';
import { Modules } from '#/modules/modules';

export const webhookSubscriptionDeleteRoute = deleteRoute({
  model: Modules.webhookSubscription,
  middleware: [validateOwnerPermission({ action: 'operate' })],
  responseSchema: WebhookSubscriptionScalarSchema,
});
