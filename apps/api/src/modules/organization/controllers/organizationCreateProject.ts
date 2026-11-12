/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses feature:project
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationCreateProjectRoute } from '#/modules/organization/routes/organizationCreateProject';

export const organizationCreateProjectController = makeController(
  organizationCreateProjectRoute,
  async (c, respond) => {
    const db = c.get('db');
    const organization = getResource<'organization'>(c);
    const project = await db.project.create({
      data: { ...c.req.valid('json'), ownerModel: 'Organization', organizationId: organization.id },
    });
    return respond.created(project);
  },
);
