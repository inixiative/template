/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { BillingProvider } from '@template/db/generated/client/enums';
import { nextFactorySequenceNumber, registerFactory } from '@template/db/test/factory';

const billingWebhookEventFactory = registerFactory('BillingWebhookEvent', {
  defaults: () => {
    const seq = nextFactorySequenceNumber();
    return {
      provider: BillingProvider.polar,
      externalEventId: `wh_evt_${seq}`,
      eventType: 'customer.state_changed',
      payload: {},
    };
  },
});

export const buildBillingWebhookEvent = billingWebhookEventFactory.build;
export const createBillingWebhookEvent = billingWebhookEventFactory.create;
