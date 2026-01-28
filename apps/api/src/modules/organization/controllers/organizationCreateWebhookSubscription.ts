import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationCreateWebhookSubscriptionRoute } from '#/modules/organization/routes/organizationCreateWebhookSubscription';

export const organizationCreateWebhookSubscriptionController = makeController(
  organizationCreateWebhookSubscriptionRoute,
  async (c, respond) => {
    const db = c.get('db');
    const org = getResource<'organization'>(c);
    const body = c.req.valid('json');

    const subscription = await db.webhookSubscription.create({
      data: {
        ...body,
        ownerModel: 'Organization',
        organizationId: org.id,
      },
    });

    return respond.created(subscription);
  },
);
