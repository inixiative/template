/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifactPlacements } from '#/modules/artifactPlacement/queries/ownerArtifactPlacementsQuery';
import { spaceReadManyArtifactPlacementsRoute } from '#/modules/space/routes/spaceReadManyArtifactPlacements';

export const spaceReadManyArtifactPlacementsController = makeController(
  spaceReadManyArtifactPlacementsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginateOwnerArtifactPlacements(c);
    return respond.ok(data, { pagination });
  },
);
