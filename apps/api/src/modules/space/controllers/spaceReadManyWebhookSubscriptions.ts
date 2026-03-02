import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { spaceReadManyWebhookSubscriptionsRoute } from '#/modules/space/routes/spaceReadManyWebhookSubscriptions';

export const spaceReadManyWebhookSubscriptionsController = makeController(
  spaceReadManyWebhookSubscriptionsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const space = getResource<'space'>(c);

    const { data, pagination } = await paginate(c, db.webhookSubscription, {
      where: { spaceId: space.id, ownerModel: 'Space' },
    });

    return respond.ok(data, { pagination });
  },
);
