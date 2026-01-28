import { webhookOwnerAllowedModels } from '#/hooks/webhooks/constants/ownerAllowedModels';
import { makeController } from '#/lib/utils/makeController';
import { webhookSubscriptionInfoRoute } from '#/modules/webhookSubscription/routes/webhookSubscriptionInfo';

export const webhookSubscriptionInfoController = makeController(webhookSubscriptionInfoRoute, async (c, respond) => {
  return respond.ok({
    models: webhookOwnerAllowedModels,
    signature: {
      publicKey: process.env.WEBHOOK_SIGNING_PUBLIC_KEY!,
      algorithm: 'Ed25519',
      encoding: 'base64',
    },
  });
});
