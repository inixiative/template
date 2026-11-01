/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses feature:project
 */
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { organizationUserReadManyProjectsRoute } from '#/modules/organizationUser/routes/organizationUserReadManyProjects';

export const organizationUserReadManyProjectsController = makeController(
  organizationUserReadManyProjectsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const member = getResource<'organizationUser'>(c);
    const { data, pagination } = await paginate(c, db.project, {
      where: {
        ownerModel: 'OrganizationUser',
        organizationId: member.organizationId,
        userId: member.userId,
      },
    });
    return respond.ok(data, { pagination });
  },
);
