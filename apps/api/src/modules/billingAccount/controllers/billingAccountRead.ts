/**
 * @atlas
 * @kind controller
 * @partOf feature:billing
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { billingAccountReadRoute } from '#/modules/billingAccount/routes/billingAccountRead';
import { toBillingAccountResponse } from '#/modules/billingAccount/schemas/billingAccountSchemas';

export const billingAccountReadController = makeController(
  billingAccountReadRoute,
  async (c, respond) => respond.ok(toBillingAccountResponse(contextResource<'billingAccount'>(c))),
);
