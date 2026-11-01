/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses feature:project
 */
import { paginate } from '#/lib/prisma/paginate';
import { submodelOwnerWhere } from '#/lib/prisma/submodelOwnerWhere';
import { makeController } from '#/lib/utils/makeController';
import { meReadManyProjectsRoute } from '#/modules/me/routes/meReadManyProjects';

export const meReadManyProjectsController = makeController(
  meReadManyProjectsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.project, { where: submodelOwnerWhere(c) });
    return respond.ok(data, { pagination });
  },
);
