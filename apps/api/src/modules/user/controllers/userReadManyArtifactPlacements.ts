/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import {
  defaultArtifactPlacementOrderBy,
  filterAccessibleArtifactPlacements,
  includeArtifactPlacementList,
  ownerArtifactPlacementsWhere,
} from '#/modules/artifactPlacement/queries/ownerArtifactPlacementsQuery';
import { userReadManyArtifactPlacementsRoute } from '#/modules/user/routes/userReadManyArtifactPlacements';

export const userReadManyArtifactPlacementsController = makeController(
  userReadManyArtifactPlacementsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const user = contextResource<'user'>(c);
    const owner = { ownerModel: 'User' as const, userId: user.id };
    const { data, pagination } = await paginate(c, db.artifactPlacement, {
      where: await ownerArtifactPlacementsWhere(c, owner),
      include: includeArtifactPlacementList,
      orderBy: defaultArtifactPlacementOrderBy(c),
    });
    return respond.ok(await filterAccessibleArtifactPlacements(c, data), { pagination });
  },
);
