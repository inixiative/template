/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import {
  filterAccessibleArtifactPlacements,
  ownerArtifactPlacementsQuery,
} from '#/modules/artifactPlacement/queries/ownerArtifactPlacementsQuery';
import { organizationUserReadManyArtifactPlacementsRoute } from '#/modules/organizationUser/routes/organizationUserReadManyArtifactPlacements';

export const organizationUserReadManyArtifactPlacementsController = makeController(
  organizationUserReadManyArtifactPlacementsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginate(
      c,
      c.get('db').artifactPlacement,
      await ownerArtifactPlacementsQuery(c),
    );
    return respond.ok(await filterAccessibleArtifactPlacements(c, data), { pagination });
  },
);
