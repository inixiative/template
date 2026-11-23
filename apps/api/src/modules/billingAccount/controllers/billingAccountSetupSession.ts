/**
 * @atlas
 * @kind controller
 * @partOf feature:billing
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { billingAccountSetupSessionRoute } from '#/modules/billingAccount/routes/billingAccountSetupSession';
import { createBillingSetupSession } from '#/modules/billingAccount/services/billingSessions';

export const billingAccountSetupSessionController = makeController(
  billingAccountSetupSessionRoute,
  async (c, respond) => {
    const account = contextResource<'billingAccount'>(c);
    const session = await createBillingSetupSession(account, c.req.valid('json'));
    return respond.ok(session);
  },
);
