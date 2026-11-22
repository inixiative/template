/**
 * @atlas
 * @kind controller
 * @partOf feature:billing
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { billingAccountUpdateRoute } from '#/modules/billingAccount/routes/billingAccountUpdate';
import { toBillingAccountResponse } from '#/modules/billingAccount/schemas/billingAccountSchemas';
import { updateBillingAccountRecord } from '#/modules/billingAccount/services/updateBillingAccount';

export const billingAccountUpdateController = makeController(
  billingAccountUpdateRoute,
  async (c, respond) => {
    const account = contextResource<'billingAccount'>(c);
    const updated = await updateBillingAccountRecord({
      account,
      ...c.req.valid('json'),
    });
    return respond.ok(toBillingAccountResponse(updated));
  },
);
