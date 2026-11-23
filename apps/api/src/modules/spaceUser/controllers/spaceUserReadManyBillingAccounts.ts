/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy, feature:billing
 * @uses feature:billing
 */
import { makeController } from '#/lib/utils/makeController';
import { fetchOwnerBillingAccounts } from '#/modules/billingAccount/services/fetchOwnerBillingAccounts';
import { spaceUserReadManyBillingAccountsRoute } from '#/modules/spaceUser/routes/spaceUserReadManyBillingAccounts';

export const spaceUserReadManyBillingAccountsController = makeController(
  spaceUserReadManyBillingAccountsRoute,
  async (c, respond) => {
    const { data, pagination } = await fetchOwnerBillingAccounts(c);
    return respond.ok(data, { pagination });
  },
);
