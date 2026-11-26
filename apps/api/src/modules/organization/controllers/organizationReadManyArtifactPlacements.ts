/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifactPlacements } from '#/modules/artifactPlacement/queries/ownerArtifactPlacementsQuery';
import { organizationReadManyArtifactPlacementsRoute } from '#/modules/organization/routes/organizationReadManyArtifactPlacements';

export const organizationReadManyArtifactPlacementsController = makeController(
  organizationReadManyArtifactPlacementsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginateOwnerArtifactPlacements(c);
    return respond.ok(data, { pagination });
  },
);
