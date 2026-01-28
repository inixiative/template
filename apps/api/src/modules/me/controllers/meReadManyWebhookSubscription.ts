import { getUser } from '#/lib/context/getUser';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { meReadManyWebhookSubscriptionRoute } from '#/modules/me/routes/meReadManyWebhookSubscription';

export const meReadManyWebhookSubscriptionController = makeController(
  meReadManyWebhookSubscriptionRoute,
  async (c, respond) => {
    const user = getUser(c)!;
    const db = c.get('db');
    const { page, pageSize } = c.req.valid('query');

    const { data, pagination } = await paginate(
      db.webhookSubscription,
      {
        where: { userId: user.id, ownerModel: 'User' },
        orderBy: { createdAt: 'desc' },
      },
      { page, pageSize },
    );

    return respond.ok(data, { pagination });
  },
);
