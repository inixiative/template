/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses feature:project
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { spaceCreateProjectRoute } from '#/modules/space/routes/spaceCreateProject';

export const spaceCreateProjectController = makeController(
  spaceCreateProjectRoute,
  async (c, respond) => {
    const db = c.get('db');
    const space = contextResource<'space'>(c);
    const project = await db.project.create({
      data: {
        ...c.req.valid('json'),
        ownerModel: 'Space',
        organizationId: space.organizationId,
        spaceId: space.id,
      },
    });
    return respond.created(project);
  },
);
