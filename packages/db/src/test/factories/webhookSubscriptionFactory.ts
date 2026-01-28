import { faker } from '@faker-js/faker';
import { WebhookModel, WebhookOwnerModel } from '@template/db/generated/client/client';
import { createFactory } from '../factory';

const webhookSubscriptionFactory = createFactory('WebhookSubscription', {
  defaults: () => ({
    model: WebhookModel.User,
    url: faker.internet.url(),
    ownerModel: WebhookOwnerModel.User,
    isActive: true,
  }),
});

export const buildWebhookSubscription = webhookSubscriptionFactory.build;
export const createWebhookSubscription = webhookSubscriptionFactory.create;
