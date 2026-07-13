/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations, superadmin
 * @uses primitive:routeTemplates
 */
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { adminIntegrationReadManyRoute } from '#/modules/integration/routes/adminIntegrationReadMany';

export const adminIntegrationReadManyController = makeController(adminIntegrationReadManyRoute, async (c, respond) => {
  const db = c.get('db');
  const { data, pagination } = await paginate(c, db.integration);
  return respond.ok(data, { pagination });
});
