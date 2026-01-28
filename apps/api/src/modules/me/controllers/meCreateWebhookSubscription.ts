import { getUser } from '#/lib/context/getUser';
import { makeController } from '#/lib/utils/makeController';
import { meCreateWebhookSubscriptionRoute } from '#/modules/me/routes/meCreateWebhookSubscription';

export const meCreateWebhookSubscriptionController = makeController(
  meCreateWebhookSubscriptionRoute,
  async (c, respond) => {
    const user = getUser(c)!;
    const db = c.get('db');
    const body = c.req.valid('json');

    const subscription = await db.webhookSubscription.create({
      data: {
        ...body,
        ownerModel: 'User',
        userId: user.id,
      },
    });

    return respond.created(subscription);
  },
);
