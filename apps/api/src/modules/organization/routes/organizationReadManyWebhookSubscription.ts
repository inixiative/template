import { WebhookSubscriptionScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { validateOrgPermission } from '#/middleware/validations/validateOrgPermission';
import { Modules } from '#/modules/modules';

export const organizationReadManyWebhookSubscriptionRoute = readRoute({
  model: Modules.organization,
  submodel: Modules.webhookSubscription,
  many: true,
  paginate: true,
  responseSchema: WebhookSubscriptionScalarSchema,
  middleware: [validateOrgPermission('read')],
});
