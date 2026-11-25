/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifactPlacements } from '#/modules/artifactPlacement/lib/paginateOwnerArtifactPlacements';
import { spaceReadManyArtifactPlacementsRoute } from '#/modules/space/routes/spaceReadManyArtifactPlacements';

export const spaceReadManyArtifactPlacementsController = makeController(
  spaceReadManyArtifactPlacementsRoute,
  async (c, respond) => {
    const space = contextResource<'space'>(c);
    const { data, pagination } = await paginateOwnerArtifactPlacements(c, {
      ownerModel: 'Space',
      organizationId: space.organizationId,
      spaceId: space.id,
    });
    return respond.ok(data, { pagination });
  },
);
