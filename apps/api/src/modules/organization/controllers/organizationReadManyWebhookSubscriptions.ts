import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { organizationReadManyWebhookSubscriptionsRoute } from '#/modules/organization/routes/organizationReadManyWebhookSubscriptions';

export const organizationReadManyWebhookSubscriptionsController = makeController(
  organizationReadManyWebhookSubscriptionsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const org = getResource<'organization'>(c);

    const { data, pagination } = await paginate(c, db.webhookSubscription, {
      where: { organizationId: org.id, ownerModel: 'Organization' },
    });

    return respond.ok(data, { pagination });
  },
);
