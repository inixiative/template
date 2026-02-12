import { faker } from '@faker-js/faker';
import { WebhookModel, WebhookOwnerModel } from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const webhookSubscriptionFactory = createFactory('WebhookSubscription', {
  defaults: () => ({
    model: WebhookModel.CustomerRef,
    url: faker.internet.url(),
    ownerModel: WebhookOwnerModel.User,
    isActive: true,
  }),
});

export const buildWebhookSubscription = webhookSubscriptionFactory.build;
export const createWebhookSubscription = webhookSubscriptionFactory.create;
