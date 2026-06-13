import { faker } from '@faker-js/faker';
import { WebhookModel, WebhookOwnerModel } from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const webhookSubscriptionFactory = createFactory('WebhookSubscription', {
  defaults: () => ({
    model: WebhookModel.CustomerRef,
    // public https URL — passes the SSRF policy (the url hook validates on every create)
    url: `https://${faker.internet.domainName()}/${faker.string.alphanumeric(8)}`,
    ownerModel: WebhookOwnerModel.User,
    isActive: true,
  }),
});

export const buildWebhookSubscription = webhookSubscriptionFactory.build;
export const createWebhookSubscription = webhookSubscriptionFactory.create;
