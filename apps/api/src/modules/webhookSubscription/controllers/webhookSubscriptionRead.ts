/**
 * @atlas
 * @kind controller
 * @partOf feature:webhooks
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { webhookSubscriptionReadRoute } from '#/modules/webhookSubscription/routes/webhookSubscriptionRead';

export const webhookSubscriptionReadController = makeController(
  webhookSubscriptionReadRoute,
  async (c, respond) => {
    const subscription = contextResource<'webhookSubscription'>(c);
    return respond.ok(subscription);
  },
);
