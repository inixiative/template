/**
 * @atlas
 * @kind controller
 * @partOf feature:billing, superadmin
 * @uses primitive:routeTemplates
 */
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { adminBillingResourceReadManyRoute } from '#/modules/billingResource/routes/adminBillingResourceReadMany';

export const adminBillingResourceReadManyController = makeController(
  adminBillingResourceReadManyRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.billingResource);
    return respond.ok(data, { pagination });
  },
);
