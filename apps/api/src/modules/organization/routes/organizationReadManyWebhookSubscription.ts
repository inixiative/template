import { WebhookSubscriptionScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const organizationReadManyWebhookSubscriptionRoute = readRoute({
  model: Modules.organization,
  submodel: Modules.webhookSubscription,
  many: true,
  paginate: true,
  responseSchema: WebhookSubscriptionScalarSchema,
  middleware: [validatePermission('read')],
});
