
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { meReadManyWebhookSubscriptionsRoute } from '#/modules/me/routes/meReadManyWebhookSubscriptions';

export const meReadManyWebhookSubscriptionsController = makeController(
  meReadManyWebhookSubscriptionsRoute,
  async (c, respond) => {
    const user = c.get('user')!;
    const db = c.get('db');

    const { data, pagination } = await paginate(c, db.webhookSubscription, {
      where: { userId: user.id, ownerModel: 'User' },
    });

    return respond.ok(data, { pagination });
  },
);
