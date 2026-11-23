/**
 * @atlas
 * @kind controller
 * @partOf feature:billing
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { billingAccountSyncRoute } from '#/modules/billingAccount/routes/billingAccountSync';
import { toBillingAccountResponse } from '#/modules/billingAccount/schemas/billingAccountSchemas';
import { syncBillingAccount } from '#/modules/billingAccount/services/billingSessions';

export const billingAccountSyncController = makeController(
  billingAccountSyncRoute,
  async (c, respond) => {
    const account = contextResource<'billingAccount'>(c);
    const synced = await syncBillingAccount(account);
    return respond.ok(toBillingAccountResponse(synced));
  },
);
