/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses feature:project
 */
import { paginate } from '#/lib/prisma/paginate';
import { submodelOwnerWhere } from '#/lib/prisma/submodelOwnerWhere';
import { makeController } from '#/lib/utils/makeController';
import { spaceUserReadManyProjectsRoute } from '#/modules/spaceUser/routes/spaceUserReadManyProjects';

export const spaceUserReadManyProjectsController = makeController(
  spaceUserReadManyProjectsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.project, { where: submodelOwnerWhere(c) });
    return respond.ok(data, { pagination });
  },
);
