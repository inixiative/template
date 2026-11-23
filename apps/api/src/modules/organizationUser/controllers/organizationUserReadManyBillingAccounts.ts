/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy, feature:billing
 * @uses feature:billing
 */
import { makeController } from '#/lib/utils/makeController';
import { fetchOwnerBillingAccounts } from '#/modules/billingAccount/services/fetchOwnerBillingAccounts';
import { organizationUserReadManyBillingAccountsRoute } from '#/modules/organizationUser/routes/organizationUserReadManyBillingAccounts';

export const organizationUserReadManyBillingAccountsController = makeController(
  organizationUserReadManyBillingAccountsRoute,
  async (c, respond) => {
    const { data, pagination } = await fetchOwnerBillingAccounts(c);
    return respond.ok(data, { pagination });
  },
);
