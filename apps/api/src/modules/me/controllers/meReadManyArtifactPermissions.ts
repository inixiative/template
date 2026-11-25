/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { actingUser } from '#/lib/context/actingUser';
import { makeController } from '#/lib/utils/makeController';
import { paginateSharedArtifactPermissions } from '#/modules/artifactPermission/lib/sharedWithOwnerWhere';
import { meReadManyArtifactPermissionsRoute } from '#/modules/me/routes/meReadManyArtifactPermissions';

export const meReadManyArtifactPermissionsController = makeController(
  meReadManyArtifactPermissionsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginateSharedArtifactPermissions(c, {
      ownerModel: 'User',
      userId: actingUser(c)!.id,
    });
    return respond.ok(data, { pagination });
  },
);
