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
import { userReadManyArtifactPlacementsRoute } from '#/modules/user/routes/userReadManyArtifactPlacements';

export const userReadManyArtifactPlacementsController = makeController(
  userReadManyArtifactPlacementsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginate(
      c,
      c.get('db').artifactPlacement,
      await ownerArtifactPlacementsQuery(c),
    );
    return respond.ok(await filterAccessibleArtifactPlacements(c, data), { pagination });
  },
);
