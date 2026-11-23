/**
 * @atlas
 * @kind controller
 * @partOf feature:billing
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { billingResourceReadRoute } from '#/modules/billingResource/routes/billingResourceRead';

export const billingResourceReadController = makeController(
  billingResourceReadRoute,
  async (c, respond) => respond.ok(contextResource<'billingResource'>(c)),
);
