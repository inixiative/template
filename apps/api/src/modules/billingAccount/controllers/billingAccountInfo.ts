/**
 * @atlas
 * @kind controller
 * @partOf feature:billing
 * @uses infrastructure:billing
 */
import { defaultBillingClient } from '#/lib/billing';
import { makeController } from '#/lib/utils/makeController';
import { billingAccountInfoRoute } from '#/modules/billingAccount/routes/billingAccountInfo';

export const billingAccountInfoController = makeController(
  billingAccountInfoRoute,
  async (_c, respond) =>
    respond.ok({
      defaultProvider: defaultBillingClient.provider,
      capabilities: defaultBillingClient.capabilities,
    }),
);
