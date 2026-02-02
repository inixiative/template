import { createRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import {
  webhookSubscriptionCreateBodySchema,
  webhookSubscriptionReadResponseSchema,
} from '#/modules/webhookSubscription/schemas/webhookSubscriptionSchemas';

export const organizationCreateWebhookSubscriptionRoute = createRoute({
  model: Modules.organization,
  submodel: Modules.webhookSubscription,
  bodySchema: webhookSubscriptionCreateBodySchema,
  responseSchema: webhookSubscriptionReadResponseSchema,
  middleware: [validatePermission('operate')],
});
