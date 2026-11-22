/**
 * @atlas
 * @kind controller
 * @partOf feature:users, feature:billing
 * @uses feature:billing
 */
import { makeController } from '#/lib/utils/makeController';
import { fetchOwnerBillingAccounts } from '#/modules/billingAccount/services/fetchOwnerBillingAccounts';
import { meReadManyBillingAccountsRoute } from '#/modules/me/routes/meReadManyBillingAccounts';

export const meReadManyBillingAccountsController = makeController(
  meReadManyBillingAccountsRoute,
  async (c, respond) => {
    const { data, pagination } = await fetchOwnerBillingAccounts(c);
    return respond.ok(data, { pagination });
  },
);
