/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses feature:project
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationCreateProjectRoute } from '#/modules/organization/routes/organizationCreateProject';

export const organizationCreateProjectController = makeController(
  organizationCreateProjectRoute,
  async (c, respond) => {
    const db = c.get('db');
    const organization = contextResource<'organization'>(c);
    const project = await db.project.create({
      data: { ...c.req.valid('json'), ownerModel: 'Organization', organizationId: organization.id },
    });
    return respond.created(project);
  },
);
