/**
 * @atlas
 * @kind controller
 * @partOf feature:webhooks
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { webhookSubscriptionDeleteRoute } from '#/modules/webhookSubscription/routes/webhookSubscriptionDelete';

export const webhookSubscriptionDeleteController = makeController(
  webhookSubscriptionDeleteRoute,
  async (c, respond) => {
    const db = c.get('db');
    const subscription = contextResource<'webhookSubscription'>(c);

    await db.webhookSubscription.delete({
      where: { id: subscription.id },
    });

    return respond.noContent();
  },
);
