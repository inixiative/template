import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { spaceCreateWebhookSubscriptionRoute } from '#/modules/space/routes/spaceCreateWebhookSubscription';

export const spaceCreateWebhookSubscriptionController = makeController(
  spaceCreateWebhookSubscriptionRoute,
  async (c, respond) => {
    const db = c.get('db');
    const space = getResource<'space'>(c);
    const body = c.req.valid('json');

    const subscription = await db.webhookSubscription.create({
      data: {
        ...body,
        ownerModel: 'Space',
        spaceId: space.id,
      },
    });

    return respond.created(subscription);
  },
);
