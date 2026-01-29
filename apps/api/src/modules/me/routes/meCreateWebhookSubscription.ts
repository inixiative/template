import { createRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';
import {
  webhookSubscriptionCreateBodySchema,
  webhookSubscriptionReadResponseSchema,
} from '#/modules/webhookSubscription/schemas/webhookSubscriptionSchemas';

export const meCreateWebhookSubscriptionRoute = createRoute({
  model: Modules.me,
  submodel: Modules.webhookSubscription,
  skipId: true,
  bodySchema: webhookSubscriptionCreateBodySchema,
  responseSchema: webhookSubscriptionReadResponseSchema,
  tags: [Tags.me, Tags.webhookSubscription],
});
