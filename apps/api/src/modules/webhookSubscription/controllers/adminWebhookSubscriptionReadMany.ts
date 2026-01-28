import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { adminWebhookSubscriptionReadManyRoute } from '#/modules/webhookSubscription/routes/webhookSubscriptionReadMany';

export const adminWebhookSubscriptionReadManyController = makeController(
  adminWebhookSubscriptionReadManyRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { page, pageSize, ownerModel, userId, organizationId, model, isActive } = c.req.valid('query');

    const where = {
      ...(ownerModel && { ownerModel }),
      ...(userId && { userId }),
      ...(organizationId && { organizationId }),
      ...(model && { model }),
      ...(isActive !== undefined && { isActive }),
    };

    const { data, pagination } = await paginate(
      db.webhookSubscription,
      { where, orderBy: { createdAt: 'desc' } },
      { page, pageSize },
    );

    return respond.ok(data, { pagination });
  },
);
