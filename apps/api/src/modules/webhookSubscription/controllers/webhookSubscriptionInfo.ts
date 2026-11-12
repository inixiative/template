/**
 * @atlas
 * @kind controller
 * @partOf feature:webhooks
 * @uses primitive:routeTemplates
 */
import { webhookOwnerAllowedModels } from '@template/db';
import { schemaGuide } from '#/lib/jsonSchema/schemaGuide';
import { makeController } from '#/lib/utils/makeController';
import { webhookSubscriptionInfoRoute } from '#/modules/webhookSubscription/routes/webhookSubscriptionInfo';
import { webhookSubscriptionInfoResponseSchema } from '#/modules/webhookSubscription/schemas/webhookSubscriptionInfoResponseSchema';

const guide = schemaGuide(webhookSubscriptionInfoResponseSchema);

export const webhookSubscriptionInfoController = makeController(
  webhookSubscriptionInfoRoute,
  async (_c, respond) => {
    return respond.ok({
      guide,
      types: {
        models: webhookOwnerAllowedModels,
        signature: {
          publicKey: process.env.WEBHOOK_SIGNING_PUBLIC_KEY!,
          algorithm: 'RSA-SHA256',
          encoding: 'base64',
        },
      },
    });
  },
);
