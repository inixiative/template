/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses feature:project
 */
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { spaceReadManyProjectsRoute } from '#/modules/space/routes/spaceReadManyProjects';

export const spaceReadManyProjectsController = makeController(
  spaceReadManyProjectsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const space = getResource<'space'>(c);
    const { data, pagination } = await paginate(c, db.project, {
      where: { ownerModel: 'Space', organizationId: space.organizationId, spaceId: space.id },
    });
    return respond.ok(data, { pagination });
  },
);
