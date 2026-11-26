/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import {
  filterAccessibleArtifactPlacements,
  ownerArtifactPlacementsQuery,
} from '#/modules/artifactPlacement/queries/ownerArtifactPlacementsQuery';
import { spaceReadManyArtifactPlacementsRoute } from '#/modules/space/routes/spaceReadManyArtifactPlacements';

export const spaceReadManyArtifactPlacementsController = makeController(
  spaceReadManyArtifactPlacementsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginate(
      c,
      c.get('db').artifactPlacement,
      await ownerArtifactPlacementsQuery(c),
    );
    return respond.ok(await filterAccessibleArtifactPlacements(c, data), { pagination });
  },
);
