/**
 * @atlas
 * @kind route
 * @partOf feature:webhooks
 * @uses primitive:routeTemplates, primitive:authz
 */
import { WebhookSubscriptionScalarSchema } from '@template/db';
import { deleteRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const webhookSubscriptionDeleteRoute = deleteRoute({
  model: Modules.webhookSubscription,
  middleware: [validatePermission('operate')],
  responseSchema: WebhookSubscriptionScalarSchema,
});
