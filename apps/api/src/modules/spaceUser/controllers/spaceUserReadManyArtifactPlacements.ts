/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
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
} from '#/modules/artifactPlacement/lib/ownerArtifactPlacementsQuery';
import { spaceUserReadManyArtifactPlacementsRoute } from '#/modules/spaceUser/routes/spaceUserReadManyArtifactPlacements';

export const spaceUserReadManyArtifactPlacementsController = makeController(
  spaceUserReadManyArtifactPlacementsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const member = contextResource<'spaceUser'>(c);
    const owner = {
      ownerModel: 'SpaceUser' as const,
      organizationId: member.organizationId,
      spaceId: member.spaceId,
      userId: member.userId,
    };
    const { data, pagination } = await paginate(c, db.artifactPlacement, {
      where: await ownerArtifactPlacementsWhere(c, owner),
      include: includeArtifactPlacementList,
      orderBy: defaultArtifactPlacementOrderBy(c),
    });
    return respond.ok(await filterReadableArtifactPlacements(c, data), { pagination });
  },
);
