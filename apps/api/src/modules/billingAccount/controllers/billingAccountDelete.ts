/**
 * @atlas
 * @kind controller
 * @partOf feature:billing
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { billingAccountDeleteRoute } from '#/modules/billingAccount/routes/billingAccountDelete';
import { deleteBillingAccountRecord } from '#/modules/billingAccount/services/deleteBillingAccount';

export const billingAccountDeleteController = makeController(
  billingAccountDeleteRoute,
  async (c, respond) => {
    const account = contextResource<'billingAccount'>(c);
    await deleteBillingAccountRecord(account);
    return respond.noContent();
  },
);
