import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { organizationReadManyWebhookSubscriptionRoute } from '#/modules/organization/routes/organizationReadManyWebhookSubscription';

export const organizationReadManyWebhookSubscriptionController = makeController(
  organizationReadManyWebhookSubscriptionRoute,
  async (c, respond) => {
    const db = c.get('db');
    const org = getResource<'organization'>(c);
    const { page, pageSize } = c.req.valid('query');

    const { data, pagination } = await paginate(
      db.webhookSubscription,
      {
        where: { organizationId: org.id, ownerModel: 'Organization' },
        orderBy: { createdAt: 'desc' },
      },
      { page, pageSize },
    );

    return respond.ok(data, { pagination });
  },
);
