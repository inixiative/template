/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { createArtifact } from '#/modules/artifact/services/createArtifact';
import { organizationUserCreateArtifactRoute } from '#/modules/organizationUser/routes/organizationUserCreateArtifact';

export const organizationUserCreateArtifactController = makeController(
  organizationUserCreateArtifactRoute,
  async (c, respond) => {
    const member = contextResource<'organizationUser'>(c);
    const artifact = await createArtifact(c.get('permix'), {
      ...c.req.valid('json'),
      ownerModel: 'OrganizationUser',
      organizationId: member.organizationId,
      userId: member.userId,
    });
    return respond.created(artifact);
  },
);
