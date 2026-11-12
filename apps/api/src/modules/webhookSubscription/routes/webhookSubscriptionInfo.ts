/**
 * @atlas
 * @kind route
 * @partOf feature:webhooks
 * @uses primitive:routeTemplates
 */
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { webhookSubscriptionInfoResponseSchema } from '#/modules/webhookSubscription/schemas/webhookSubscriptionInfoResponseSchema';

export const webhookSubscriptionInfoRoute = readRoute({
  model: Modules.webhookSubscription,
  action: 'info',
  skipId: true,
  responseSchema: webhookSubscriptionInfoResponseSchema,
  description:
    'Returns webhook public key and available models. Signed payloads include an ISO-8601 `timestamp` field; receivers should reject deliveries older than a few minutes to prevent replay. Public endpoint.',
});
