/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:webhooks
 */
import { createRoute } from '#/lib/routeTemplates';
import { validateSelfPermission } from '#/middleware/validations/validateSelfPermission';
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
  middleware: [validateSelfPermission('operate')],
  tags: [Tags.me, Tags.webhookSubscription],
});
