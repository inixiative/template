/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy, feature:billing
 * @uses feature:billing
 */
import { makeController } from '#/lib/utils/makeController';
import { fetchOwnerBillingAccounts } from '#/modules/billingAccount/services/fetchOwnerBillingAccounts';
import { spaceReadManyBillingAccountsRoute } from '#/modules/space/routes/spaceReadManyBillingAccounts';

export const spaceReadManyBillingAccountsController = makeController(
  spaceReadManyBillingAccountsRoute,
  async (c, respond) => {
    const { data, pagination } = await fetchOwnerBillingAccounts(c);
    return respond.ok(data, { pagination });
  },
);
