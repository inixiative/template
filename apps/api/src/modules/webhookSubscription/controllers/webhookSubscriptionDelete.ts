import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { webhookSubscriptionDeleteRoute } from '#/modules/webhookSubscription/routes/webhookSubscriptionDelete';

export const webhookSubscriptionDeleteController = makeController(webhookSubscriptionDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const subscription = getResource<'webhookSubscription'>(c);

  // TODO: Add permix permission checks

  await db.webhookSubscription.delete({
    where: { id: subscription.id },
  });

  return respond.noContent();
});
