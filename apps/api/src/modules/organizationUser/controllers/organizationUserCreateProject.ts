/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses feature:project
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationUserCreateProjectRoute } from '#/modules/organizationUser/routes/organizationUserCreateProject';

export const organizationUserCreateProjectController = makeController(
  organizationUserCreateProjectRoute,
  async (c, respond) => {
    const db = c.get('db');
    const member = contextResource<'organizationUser'>(c);
    const project = await db.project.create({
      data: {
        ...c.req.valid('json'),
        ownerModel: 'OrganizationUser',
        organizationId: member.organizationId,
        userId: member.userId,
      },
    });
    return respond.created(project);
  },
);
