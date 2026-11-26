/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifactPermissions } from '#/modules/artifactPermission/queries/sharedWithOwnerWhere';
import { spaceReadManyArtifactPermissionsRoute } from '#/modules/space/routes/spaceReadManyArtifactPermissions';

export const spaceReadManyArtifactPermissionsController = makeController(
  spaceReadManyArtifactPermissionsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginateOwnerArtifactPermissions(c);
    return respond.ok(data, { pagination });
  },
);
