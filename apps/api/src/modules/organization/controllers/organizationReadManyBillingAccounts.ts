/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy, feature:billing
 * @uses feature:billing
 */
import { makeController } from '#/lib/utils/makeController';
import { fetchOwnerBillingAccounts } from '#/modules/billingAccount/services/fetchOwnerBillingAccounts';
import { organizationReadManyBillingAccountsRoute } from '#/modules/organization/routes/organizationReadManyBillingAccounts';

export const organizationReadManyBillingAccountsController = makeController(
  organizationReadManyBillingAccountsRoute,
  async (c, respond) => {
    const { data, pagination } = await fetchOwnerBillingAccounts(c);
    return respond.ok(data, { pagination });
  },
);
