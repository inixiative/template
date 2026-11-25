/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifactPlacements } from '#/modules/artifactPlacement/lib/paginateOwnerArtifactPlacements';
import { spaceUserReadManyArtifactPlacementsRoute } from '#/modules/spaceUser/routes/spaceUserReadManyArtifactPlacements';

export const spaceUserReadManyArtifactPlacementsController = makeController(
  spaceUserReadManyArtifactPlacementsRoute,
  async (c, respond) => {
    const member = contextResource<'spaceUser'>(c);
    const { data, pagination } = await paginateOwnerArtifactPlacements(c, {
      ownerModel: 'SpaceUser',
      organizationId: member.organizationId,
      spaceId: member.spaceId,
      userId: member.userId,
    });
    return respond.ok(data, { pagination });
  },
);
