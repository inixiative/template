/**
 * @atlas
 * @kind controller
 * @partOf feature:billing
 */
import { makeController } from '#/lib/utils/makeController';
import { billingResourceCreateRoute } from '#/modules/billingResource/routes/billingResourceCreate';
import { createBillingResourceRecord } from '#/modules/billingResource/services/createBillingResource';

export const billingResourceCreateController = makeController(
  billingResourceCreateRoute,
  async (c, respond) => {
    const resource = await createBillingResourceRecord(c, c.req.valid('json'));
    return respond.created(resource);
  },
);
