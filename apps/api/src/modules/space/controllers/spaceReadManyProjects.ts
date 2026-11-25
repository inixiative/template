/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses feature:project
 */
import { fetchSubmodelVisibilityWhere } from '#/lib/prisma/fetchSubmodelVisibilityWhere';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { spaceReadManyProjectsRoute } from '#/modules/space/routes/spaceReadManyProjects';

export const spaceReadManyProjectsController = makeController(
  spaceReadManyProjectsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const where = await fetchSubmodelVisibilityWhere(c);
    const { data, pagination } = await paginate(c, db.project, { where });
    return respond.ok(data, { pagination });
  },
);
