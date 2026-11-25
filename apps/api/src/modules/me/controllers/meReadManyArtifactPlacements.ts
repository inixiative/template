/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { actingUser } from '#/lib/context/actingUser';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import {
  defaultArtifactPlacementOrderBy,
  filterAccessibleArtifactPlacements,
  includeArtifactPlacementList,
  ownerArtifactPlacementsWhere,
} from '#/modules/artifactPlacement/queries/ownerArtifactPlacementsQuery';
import { meReadManyArtifactPlacementsRoute } from '#/modules/me/routes/meReadManyArtifactPlacements';

export const meReadManyArtifactPlacementsController = makeController(
  meReadManyArtifactPlacementsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const owner = { ownerModel: 'User' as const, userId: actingUser(c)!.id };
    const { data, pagination } = await paginate(c, db.artifactPlacement, {
      where: await ownerArtifactPlacementsWhere(c, owner),
      include: includeArtifactPlacementList,
      orderBy: defaultArtifactPlacementOrderBy(c),
    });
    return respond.ok(await filterAccessibleArtifactPlacements(c, data), { pagination });
  },
);
