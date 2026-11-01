/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses feature:project
 */
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { spaceUserReadManyProjectsRoute } from '#/modules/spaceUser/routes/spaceUserReadManyProjects';

export const spaceUserReadManyProjectsController = makeController(
  spaceUserReadManyProjectsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const member = getResource<'spaceUser'>(c);
    const { data, pagination } = await paginate(c, db.project, {
      where: {
        ownerModel: 'SpaceUser',
        organizationId: member.organizationId,
        spaceId: member.spaceId,
        userId: member.userId,
      },
    });
    return respond.ok(data, { pagination });
  },
);
