/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifactPlacements } from '#/modules/artifactPlacement/queries/ownerArtifactPlacementsQuery';
import { organizationUserReadManyArtifactPlacementsRoute } from '#/modules/organizationUser/routes/organizationUserReadManyArtifactPlacements';

export const organizationUserReadManyArtifactPlacementsController = makeController(
  organizationUserReadManyArtifactPlacementsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginateOwnerArtifactPlacements(c);
    return respond.ok(data, { pagination });
  },
);
