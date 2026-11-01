/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses feature:project
 */
import { me } from '#/lib/context/me';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { meReadManyProjectsRoute } from '#/modules/me/routes/meReadManyProjects';

export const meReadManyProjectsController = makeController(
  meReadManyProjectsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const user = me(c)!;
    const { data, pagination } = await paginate(c, db.project, {
      where: { ownerModel: 'User', userId: user.id },
    });
    return respond.ok(data, { pagination });
  },
);
