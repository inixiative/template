/**
 * @atlas
 * @kind controller
 * @partOf feature:project, superadmin
 * @uses primitive:routeTemplates
 */
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { adminProjectReadManyRoute } from '#/modules/project/routes/adminProjectReadMany';

export const adminProjectReadManyController = makeController(
  adminProjectReadManyRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.project);
    return respond.ok(data, { pagination });
  },
);
