/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { registerFactory } from '@template/db/test/factory';

const webhookSubscriptionFactory = registerFactory('WebhookSubscription', {
  defaults: () => ({
    // public https URL — passes the SSRF policy (the url hook validates on every create)
    url: `https://${faker.internet.domainName()}/${faker.string.alphanumeric(8)}`,
    isActive: true,
  }),
});

export const buildWebhookSubscription = webhookSubscriptionFactory.build;
export const createWebhookSubscription = webhookSubscriptionFactory.create;
