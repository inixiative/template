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
import { organizationReadManyArtifactPlacementsRoute } from '#/modules/organization/routes/organizationReadManyArtifactPlacements';

export const organizationReadManyArtifactPlacementsController = makeController(
  organizationReadManyArtifactPlacementsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const organization = contextResource<'organization'>(c);
    const owner = { ownerModel: 'Organization' as const, organizationId: organization.id };
    const { data, pagination } = await paginate(c, db.artifactPlacement, {
      where: await ownerArtifactPlacementsWhere(c, owner),
      include: includeArtifactPlacementList,
      orderBy: defaultArtifactPlacementOrderBy(c),
    });
    return respond.ok(await filterAccessibleArtifactPlacements(c, data), { pagination });
  },
);
