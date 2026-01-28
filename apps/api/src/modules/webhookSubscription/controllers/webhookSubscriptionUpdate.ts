import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { webhookSubscriptionUpdateRoute } from '#/modules/webhookSubscription/routes/webhookSubscriptionUpdate';

export const webhookSubscriptionUpdateController = makeController(webhookSubscriptionUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const subscription = getResource<'webhookSubscription'>(c);
  const body = c.req.valid('json');

  // Re-activate unless explicitly set to false (undefined = true)
  const isActive = body.isActive !== false;

  const updated = await db.webhookSubscription.update({
    where: { id: subscription.id },
    data: { ...body, isActive },
  });

  return respond.ok(updated);
});
