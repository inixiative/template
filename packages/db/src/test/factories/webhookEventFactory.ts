import { faker } from '@faker-js/faker';
import { WebhookEventAction, WebhookEventStatus } from '@template/db/generated/client/client';
import { createFactory } from '../factory';

const webhookEventFactory = createFactory('WebhookEvent', {
  defaults: () => ({
    status: WebhookEventStatus.pending,
    action: WebhookEventAction.create,
    payload: { test: true },
    error: null,
    resourceId: faker.string.uuid(),
  }),
  dependencies: {
    webhookSubscription: {
      modelName: 'WebhookSubscription',
      foreignKey: 'webhookSubscriptionId',
      required: true,
    },
  },
});

export const buildWebhookEvent = webhookEventFactory.build;
export const createWebhookEvent = webhookEventFactory.create;
