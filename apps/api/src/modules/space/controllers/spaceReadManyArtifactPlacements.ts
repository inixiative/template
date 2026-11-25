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
  filterReadableArtifactPlacements,
  includeArtifactPlacementList,
  ownerArtifactPlacementsWhere,
} from '#/modules/artifactPlacement/queries/ownerArtifactPlacementsQuery';
import { spaceReadManyArtifactPlacementsRoute } from '#/modules/space/routes/spaceReadManyArtifactPlacements';

export const spaceReadManyArtifactPlacementsController = makeController(
  spaceReadManyArtifactPlacementsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const space = contextResource<'space'>(c);
    const owner = {
      ownerModel: 'Space' as const,
      organizationId: space.organizationId,
      spaceId: space.id,
    };
    const { data, pagination } = await paginate(c, db.artifactPlacement, {
      where: await ownerArtifactPlacementsWhere(c, owner),
      include: includeArtifactPlacementList,
      orderBy: defaultArtifactPlacementOrderBy(c),
    });
    return respond.ok(await filterReadableArtifactPlacements(c, data), { pagination });
  },
);
