/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, infrastructure:prisma, feature:webhooks
 */

import { paginate } from '#/lib/prisma/paginate';
import { submodelOwnerWhere } from '#/lib/prisma/submodelOwnerWhere';
import { makeController } from '#/lib/utils/makeController';
import { meReadManyWebhookSubscriptionsRoute } from '#/modules/me/routes/meReadManyWebhookSubscriptions';

export const meReadManyWebhookSubscriptionsController = makeController(
  meReadManyWebhookSubscriptionsRoute,
  async (c, respond) => {
    const db = c.get('db');

    const { data, pagination } = await paginate(c, db.webhookSubscription, {
      where: submodelOwnerWhere(c),
    });

    return respond.ok(data, { pagination });
  },
);
