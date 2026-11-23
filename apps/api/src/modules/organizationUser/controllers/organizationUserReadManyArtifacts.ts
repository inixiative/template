/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { fetchRootArtifacts } from '#/modules/artifact/services/fetchRootArtifacts';
import { organizationUserReadManyArtifactsRoute } from '#/modules/organizationUser/routes/organizationUserReadManyArtifacts';

export const organizationUserReadManyArtifactsController = makeController(
  organizationUserReadManyArtifactsRoute,
  async (c, respond) => {
    const member = contextResource<'organizationUser'>(c);
    const roots = await fetchRootArtifacts(c.get('permix'), {
      ownerModel: 'OrganizationUser',
      organizationId: member.organizationId,
      userId: member.userId,
    });
    return respond.ok(roots);
  },
);
