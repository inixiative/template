/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifactPlacements } from '#/modules/artifactPlacement/lib/paginateOwnerArtifactPlacements';
import { organizationReadManyArtifactPlacementsRoute } from '#/modules/organization/routes/organizationReadManyArtifactPlacements';

export const organizationReadManyArtifactPlacementsController = makeController(
  organizationReadManyArtifactPlacementsRoute,
  async (c, respond) => {
    const organization = contextResource<'organization'>(c);
    const { data, pagination } = await paginateOwnerArtifactPlacements(c, {
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    return respond.ok(data, { pagination });
  },
);
