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
  filterAccessibleArtifactPlacements,
  includeArtifactPlacementList,
  ownerArtifactPlacementsWhere,
} from '#/modules/artifactPlacement/queries/ownerArtifactPlacementsQuery';
import { organizationUserReadManyArtifactPlacementsRoute } from '#/modules/organizationUser/routes/organizationUserReadManyArtifactPlacements';

export const organizationUserReadManyArtifactPlacementsController = makeController(
  organizationUserReadManyArtifactPlacementsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const member = contextResource<'organizationUser'>(c);
    const owner = {
      ownerModel: 'OrganizationUser' as const,
      organizationId: member.organizationId,
      userId: member.userId,
    };
    const { data, pagination } = await paginate(c, db.artifactPlacement, {
      where: await ownerArtifactPlacementsWhere(c, owner),
      include: includeArtifactPlacementList,
      orderBy: defaultArtifactPlacementOrderBy(c),
    });
    return respond.ok(await filterAccessibleArtifactPlacements(c, data), { pagination });
  },
);
