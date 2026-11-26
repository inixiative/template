/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifactPlacements } from '#/modules/artifactPlacement/queries/ownerArtifactPlacementsQuery';
import { meReadManyArtifactPlacementsRoute } from '#/modules/me/routes/meReadManyArtifactPlacements';

export const meReadManyArtifactPlacementsController = makeController(
  meReadManyArtifactPlacementsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginateOwnerArtifactPlacements(c);
    return respond.ok(data, { pagination });
  },
);
