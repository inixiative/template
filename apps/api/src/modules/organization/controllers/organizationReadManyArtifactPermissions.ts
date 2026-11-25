/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { paginateSharedArtifactPermissions } from '#/modules/artifactPermission/lib/sharedWithOwnerWhere';
import { organizationReadManyArtifactPermissionsRoute } from '#/modules/organization/routes/organizationReadManyArtifactPermissions';

export const organizationReadManyArtifactPermissionsController = makeController(
  organizationReadManyArtifactPermissionsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginateSharedArtifactPermissions(c, {
      ownerModel: 'Organization',
      organizationId: contextResource<'organization'>(c).id,
    });
    return respond.ok(data, { pagination });
  },
);
