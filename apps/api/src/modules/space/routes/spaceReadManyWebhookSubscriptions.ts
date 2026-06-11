/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { WebhookSubscriptionScalarSchema } from '@template/db';
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const spaceReadManyWebhookSubscriptionsRoute = readRoute({
  model: Modules.space,
  submodel: Modules.webhookSubscription,
  many: true,
  paginate: true,
  filterLens: { parent: lensFor('WebhookSubscription') },
  responseSchema: WebhookSubscriptionScalarSchema,
  middleware: [validatePermission('read')],
});
