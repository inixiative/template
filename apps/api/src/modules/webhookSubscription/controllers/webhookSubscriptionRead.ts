import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { webhookSubscriptionReadRoute } from '#/modules/webhookSubscription/routes/webhookSubscriptionRead';

export const webhookSubscriptionReadController = makeController(webhookSubscriptionReadRoute, async (c, respond) => {
  const subscription = getResource<'webhookSubscription'>(c);
  return respond.ok(subscription);
});
