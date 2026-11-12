/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { paginate } from '#/lib/prisma/paginate';
import { submodelOwnerWhere } from '#/lib/prisma/submodelOwnerWhere';
import { makeController } from '#/lib/utils/makeController';
import { spaceReadManyWebhookSubscriptionsRoute } from '#/modules/space/routes/spaceReadManyWebhookSubscriptions';

export const spaceReadManyWebhookSubscriptionsController = makeController(
  spaceReadManyWebhookSubscriptionsRoute,
  async (c, respond) => {
    const db = c.get('db');

    const { data, pagination } = await paginate(c, db.webhookSubscription, {
      where: submodelOwnerWhere(c),
    });

    return respond.ok(data, { pagination });
  },
);
