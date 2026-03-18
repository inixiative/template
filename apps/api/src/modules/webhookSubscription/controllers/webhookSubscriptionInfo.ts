import { webhookOwnerAllowedModels } from '@template/db';
import { makeController } from '#/lib/utils/makeController';
import { webhookSubscriptionInfoRoute } from '#/modules/webhookSubscription/routes/webhookSubscriptionInfo';

export const webhookSubscriptionInfoController = makeController(webhookSubscriptionInfoRoute, async (_c, respond) => {
  return respond.ok({
    models: webhookOwnerAllowedModels,
    signature: {
      publicKey: process.env.WEBHOOK_SIGNING_PUBLIC_KEY!,
      algorithm: 'RSA-SHA256',
      encoding: 'base64',
    },
  });
});
