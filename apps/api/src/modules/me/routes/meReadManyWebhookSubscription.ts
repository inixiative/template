import { WebhookSubscriptionScalarSchema } from '@template/db';
import { readRoute } from '#/lib/requestTemplates';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const meReadManyWebhookSubscriptionRoute = readRoute({
  model: Modules.me,
  submodel: Modules.webhookSubscription,
  many: true,
  skipId: true,
  paginate: true,
  responseSchema: WebhookSubscriptionScalarSchema,
  tags: [Tags.me, Tags.webhookSubscription],
});
