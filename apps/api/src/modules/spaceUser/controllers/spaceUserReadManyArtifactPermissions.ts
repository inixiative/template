/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifactPermissions } from '#/modules/artifactPermission/queries/sharedWithOwnerWhere';
import { spaceUserReadManyArtifactPermissionsRoute } from '#/modules/spaceUser/routes/spaceUserReadManyArtifactPermissions';

export const spaceUserReadManyArtifactPermissionsController = makeController(
  spaceUserReadManyArtifactPermissionsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginateOwnerArtifactPermissions(c);
    return respond.ok(data, { pagination });
  },
);
