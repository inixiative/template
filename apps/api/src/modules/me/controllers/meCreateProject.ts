/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses feature:project
 */
import { me } from '#/lib/context/me';
import { makeController } from '#/lib/utils/makeController';
import { meCreateProjectRoute } from '#/modules/me/routes/meCreateProject';

export const meCreateProjectController = makeController(
  meCreateProjectRoute,
  async (c, respond) => {
    const db = c.get('db');
    const user = me(c)!;
    const project = await db.project.create({
      data: { ...c.req.valid('json'), ownerModel: 'User', userId: user.id },
    });
    return respond.created(project);
  },
);
