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

export const spaceCreateWebhookSubscriptionRoute = createRoute({
  model: Modules.space,
  submodel: Modules.webhookSubscription,
  bodySchema: webhookSubscriptionCreateBodySchema,
  responseSchema: webhookSubscriptionReadResponseSchema,
  middleware: [validateSubmodelPermission('create')],
  sanitizeKeys: ['ownerModel', 'userId', 'organizationId', 'spaceId'],
});
