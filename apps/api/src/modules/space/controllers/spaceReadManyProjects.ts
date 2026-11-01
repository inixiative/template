/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses feature:project
 */
import { paginate } from '#/lib/prisma/paginate';
import { submodelOwnerWhere } from '#/lib/prisma/submodelOwnerWhere';
import { makeController } from '#/lib/utils/makeController';
import { spaceReadManyProjectsRoute } from '#/modules/space/routes/spaceReadManyProjects';

export const spaceReadManyProjectsController = makeController(
  spaceReadManyProjectsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.project, { where: submodelOwnerWhere(c) });
    return respond.ok(data, { pagination });
  },
);
