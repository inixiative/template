/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses feature:project
 */
import { fetchSubmodelAccessWhere } from '#/lib/prisma/fetchSubmodelAccessWhere';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { meReadManyProjectsRoute } from '#/modules/me/routes/meReadManyProjects';

export const meReadManyProjectsController = makeController(
  meReadManyProjectsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const where = await fetchSubmodelAccessWhere(c);
    const { data, pagination } = await paginate(c, db.project, { where });
    return respond.ok(data, { pagination });
  },
);
