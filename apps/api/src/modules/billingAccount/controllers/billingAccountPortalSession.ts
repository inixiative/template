/**
 * @atlas
 * @kind controller
 * @partOf feature:billing
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { billingAccountPortalSessionRoute } from '#/modules/billingAccount/routes/billingAccountPortalSession';
import { createBillingPortalSession } from '#/modules/billingAccount/services/billingSessions';

export const billingAccountPortalSessionController = makeController(
  billingAccountPortalSessionRoute,
  async (c, respond) => {
    const account = contextResource<'billingAccount'>(c);
    const { returnUrl } = c.req.valid('json');
    const session = await createBillingPortalSession(account, returnUrl);
    return respond.ok(session);
  },
);
