/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses feature:project
 */
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { organizationReadManyProjectsRoute } from '#/modules/organization/routes/organizationReadManyProjects';

export const organizationReadManyProjectsController = makeController(
  organizationReadManyProjectsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const organization = getResource<'organization'>(c);
    const { data, pagination } = await paginate(c, db.project, {
      where: { ownerModel: 'Organization', organizationId: organization.id },
    });
    return respond.ok(data, { pagination });
  },
);
