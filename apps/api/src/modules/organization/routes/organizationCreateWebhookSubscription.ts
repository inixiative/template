/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:webhooks
 */
import { createRoute } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
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
  middleware: [validateSubmodelPermission('create')],
});
