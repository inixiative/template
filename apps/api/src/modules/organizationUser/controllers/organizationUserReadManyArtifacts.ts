/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifacts } from '#/modules/artifact/services/paginateOwnerArtifacts';
import { organizationUserReadManyArtifactsRoute } from '#/modules/organizationUser/routes/organizationUserReadManyArtifacts';

export const organizationUserReadManyArtifactsController = makeController(
  organizationUserReadManyArtifactsRoute,
  async (c, respond) => {
    const member = contextResource<'organizationUser'>(c);
    const { data, pagination } = await paginateOwnerArtifacts(c, {
      ownerModel: 'OrganizationUser',
      organizationId: member.organizationId,
      userId: member.userId,
    });
    return respond.ok(data, { pagination });
  },
);
