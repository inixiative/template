/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifactPermissions } from '#/modules/artifactPermission/queries/sharedWithOwnerWhere';
import { organizationReadManyArtifactPermissionsRoute } from '#/modules/organization/routes/organizationReadManyArtifactPermissions';

export const organizationReadManyArtifactPermissionsController = makeController(
  organizationReadManyArtifactPermissionsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginateOwnerArtifactPermissions(c);
    return respond.ok(data, { pagination });
  },
);
