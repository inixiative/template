/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses feature:project
 */
import { fetchSubmodelVisibilityWhere } from '#/lib/prisma/fetchSubmodelVisibilityWhere';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { spaceUserReadManyProjectsRoute } from '#/modules/spaceUser/routes/spaceUserReadManyProjects';

export const spaceUserReadManyProjectsController = makeController(
  spaceUserReadManyProjectsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const where = await fetchSubmodelVisibilityWhere(c);
    const { data, pagination } = await paginate(c, db.project, { where });
    return respond.ok(data, { pagination });
  },
);
