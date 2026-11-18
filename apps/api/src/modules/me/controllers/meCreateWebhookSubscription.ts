/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, infrastructure:prisma, feature:webhooks
 */

import { actingUser } from '#/lib/context/actingUser';
import { makeController } from '#/lib/utils/makeController';
import { meCreateWebhookSubscriptionRoute } from '#/modules/me/routes/meCreateWebhookSubscription';

export const meCreateWebhookSubscriptionController = makeController(
  meCreateWebhookSubscriptionRoute,
  async (c, respond) => {
    const user = actingUser(c)!;
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
