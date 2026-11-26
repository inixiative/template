/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifactPermissions } from '#/modules/artifactPermission/queries/sharedWithOwnerWhere';
import { meReadManyArtifactPermissionsRoute } from '#/modules/me/routes/meReadManyArtifactPermissions';

export const meReadManyArtifactPermissionsController = makeController(
  meReadManyArtifactPermissionsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginateOwnerArtifactPermissions(c);
    return respond.ok(data, { pagination });
  },
);
