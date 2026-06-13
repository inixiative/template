import { WebhookSubscriptionScalarInputSchema, WebhookSubscriptionScalarSchema } from '@template/db';
import { updateRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { webhookUrlSchema } from '#/modules/webhookSubscription/schemas/webhookSubscriptionSchemas';

export const webhookSubscriptionUpdateRoute = updateRoute({
  model: Modules.webhookSubscription,
  middleware: [validatePermission('operate')],
  bodySchema: WebhookSubscriptionScalarInputSchema.partial().extend({ url: webhookUrlSchema.optional() }),
  sanitizeKeys: ['model', 'ownerModel', 'userId', 'organizationId'],
  responseSchema: WebhookSubscriptionScalarSchema,
});
