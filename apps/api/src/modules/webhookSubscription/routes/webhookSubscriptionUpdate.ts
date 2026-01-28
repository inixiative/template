import { WebhookSubscriptionScalarSchema } from '@template/db';
import { updateRoute } from '#/lib/requestTemplates';
import { validateOwnerPermission } from '#/middleware/validations/validateOwnerPermission';
import { Modules } from '#/modules/modules';

export const webhookSubscriptionUpdateRoute = updateRoute({
  model: Modules.webhookSubscription,
  middleware: [validateOwnerPermission({ action: 'operate' })],
  bodySchema: WebhookSubscriptionScalarSchema.partial(),
  sanitizeKeys: ['model', 'ownerModel', 'userId', 'organizationId'],
  responseSchema: WebhookSubscriptionScalarSchema,
});
