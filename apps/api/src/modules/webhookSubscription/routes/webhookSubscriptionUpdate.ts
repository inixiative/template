import { WebhookSubscriptionScalarInputSchema, WebhookSubscriptionScalarSchema } from '@template/db';
import { updateRoute } from '#/lib/routeTemplates';
import { validateOwnerPermission } from '#/middleware/validations/validateOwnerPermission';
import { Modules } from '#/modules/modules';

export const webhookSubscriptionUpdateRoute = updateRoute({
  model: Modules.webhookSubscription,
  middleware: [validateOwnerPermission({ action: 'operate' })],
  bodySchema: WebhookSubscriptionScalarInputSchema.partial(),
  sanitizeKeys: ['model', 'ownerModel', 'userId', 'organizationId'],
  responseSchema: WebhookSubscriptionScalarSchema,
});
