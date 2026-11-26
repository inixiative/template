/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifactPlacements } from '#/modules/artifactPlacement/queries/ownerArtifactPlacementsQuery';
import { userReadManyArtifactPlacementsRoute } from '#/modules/user/routes/userReadManyArtifactPlacements';

export const userReadManyArtifactPlacementsController = makeController(
  userReadManyArtifactPlacementsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginateOwnerArtifactPlacements(c);
    return respond.ok(data, { pagination });
  },
);
