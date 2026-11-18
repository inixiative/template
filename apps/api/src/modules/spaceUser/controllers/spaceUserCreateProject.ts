/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses feature:project
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { spaceUserCreateProjectRoute } from '#/modules/spaceUser/routes/spaceUserCreateProject';

export const spaceUserCreateProjectController = makeController(
  spaceUserCreateProjectRoute,
  async (c, respond) => {
    const db = c.get('db');
    const member = contextResource<'spaceUser'>(c);
    const project = await db.project.create({
      data: {
        ...c.req.valid('json'),
        ownerModel: 'SpaceUser',
        organizationId: member.organizationId,
        spaceId: member.spaceId,
        userId: member.userId,
      },
    });
    return respond.created(project);
  },
);
