import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { adminWebhookSubscriptionReadManyRoute } from '#/modules/webhookSubscription/routes/webhookSubscriptionReadMany';

export const adminWebhookSubscriptionReadManyController = makeController(
  adminWebhookSubscriptionReadManyRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { ownerModel, userId, organizationId, model, isActive } = c.req.valid('query');

    const { data, pagination } = await paginate(c, db.webhookSubscription, {
      searchableFields: ['url', 'model'],
      where: {
        ...(ownerModel && { ownerModel }),
        ...(userId && { userId }),
        ...(organizationId && { organizationId }),
        ...(model && { model }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return respond.ok(data, { pagination });
  },
);
