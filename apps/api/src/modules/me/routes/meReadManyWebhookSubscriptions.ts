/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:webhooks
 */
import { WebhookSubscriptionScalarSchema } from '@template/db';
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const meReadManyWebhookSubscriptionsRoute = readRoute({
  model: Modules.me,
  middleware: [validateSubmodelPermission('read')],
  submodel: Modules.webhookSubscription,
  many: true,
  skipId: true,
  paginate: true,
  filterLens: { parent: lensFor('WebhookSubscription') },
  responseSchema: WebhookSubscriptionScalarSchema,
  tags: [Tags.me, Tags.webhookSubscription],
});
