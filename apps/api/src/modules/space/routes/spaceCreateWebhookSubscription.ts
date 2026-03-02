import { createRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import {
  webhookSubscriptionCreateBodySchema,
  webhookSubscriptionReadResponseSchema,
} from '#/modules/webhookSubscription/schemas/webhookSubscriptionSchemas';

export const spaceCreateWebhookSubscriptionRoute = createRoute({
  model: Modules.space,
  submodel: Modules.webhookSubscription,
  bodySchema: webhookSubscriptionCreateBodySchema,
  responseSchema: webhookSubscriptionReadResponseSchema,
  middleware: [validatePermission('operate')],
  sanitizeKeys: ['ownerModel', 'userId', 'organizationId', 'spaceId'],
});
