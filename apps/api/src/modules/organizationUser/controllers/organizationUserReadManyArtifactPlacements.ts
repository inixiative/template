/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifactPlacements } from '#/modules/artifactPlacement/lib/paginateOwnerArtifactPlacements';
import { organizationUserReadManyArtifactPlacementsRoute } from '#/modules/organizationUser/routes/organizationUserReadManyArtifactPlacements';

export const organizationUserReadManyArtifactPlacementsController = makeController(
  organizationUserReadManyArtifactPlacementsRoute,
  async (c, respond) => {
    const member = contextResource<'organizationUser'>(c);
    const { data, pagination } = await paginateOwnerArtifactPlacements(c, {
      ownerModel: 'OrganizationUser',
      organizationId: member.organizationId,
      userId: member.userId,
    });
    return respond.ok(data, { pagination });
  },
);
