/**
 * @atlas
 * @kind controller
 * @partOf feature:project, superadmin
 * @uses primitive:routeTemplates
 */
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { adminProjectIntegrationReadManyRoute } from '#/modules/projectIntegration/routes/adminProjectIntegrationReadMany';

export const adminProjectIntegrationReadManyController = makeController(
  adminProjectIntegrationReadManyRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.projectIntegration);
    return respond.ok(data, { pagination });
  },
);
