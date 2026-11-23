/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { BillingProvider } from '@template/db/generated/client/enums';
import { nextFactorySequenceNumber, registerFactory } from '@template/db/test/factory';

const billingAccountFactory = registerFactory('BillingAccount', {
  defaults: () => {
    const seq = nextFactorySequenceNumber();
    return {
      name: `Billing Account ${seq}`,
      billingEmail: `billing-${seq}@example.com`,
      provider: BillingProvider.polar,
    };
  },
});

export const buildBillingAccount = billingAccountFactory.build;
export const createBillingAccount = billingAccountFactory.create;
