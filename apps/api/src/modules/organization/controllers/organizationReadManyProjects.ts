/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses feature:project
 */
import { paginate } from '#/lib/prisma/paginate';
import { submodelOwnerWhere } from '#/lib/prisma/submodelOwnerWhere';
import { makeController } from '#/lib/utils/makeController';
import { organizationReadManyProjectsRoute } from '#/modules/organization/routes/organizationReadManyProjects';

export const organizationReadManyProjectsController = makeController(
  organizationReadManyProjectsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.project, { where: submodelOwnerWhere(c) });
    return respond.ok(data, { pagination });
  },
);
