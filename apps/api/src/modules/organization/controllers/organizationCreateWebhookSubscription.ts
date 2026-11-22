/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationCreateWebhookSubscriptionRoute } from '#/modules/organization/routes/organizationCreateWebhookSubscription';

export const organizationCreateWebhookSubscriptionController = makeController(
  organizationCreateWebhookSubscriptionRoute,
  async (c, respond) => {
    const db = c.get('db');
    const org = contextResource<'organization'>(c);
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
