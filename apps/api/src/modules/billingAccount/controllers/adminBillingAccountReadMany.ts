/**
 * @atlas
 * @kind controller
 * @partOf feature:billing, superadmin
 * @uses primitive:routeTemplates
 */
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { adminBillingAccountReadManyRoute } from '#/modules/billingAccount/routes/adminBillingAccountReadMany';
import { toBillingAccountResponse } from '#/modules/billingAccount/schemas/billingAccountSchemas';

export const adminBillingAccountReadManyController = makeController(
  adminBillingAccountReadManyRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.billingAccount);
    return respond.ok(data.map(toBillingAccountResponse), { pagination });
  },
);
