/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { paginateSharedArtifactPermissions } from '#/modules/artifactPermission/lib/sharedWithOwnerWhere';
import { spaceReadManyArtifactPermissionsRoute } from '#/modules/space/routes/spaceReadManyArtifactPermissions';

export const spaceReadManyArtifactPermissionsController = makeController(
  spaceReadManyArtifactPermissionsRoute,
  async (c, respond) => {
    const space = contextResource<'space'>(c);
    const { data, pagination } = await paginateSharedArtifactPermissions(c, {
      ownerModel: 'Space',
      organizationId: space.organizationId,
      spaceId: space.id,
    });
    return respond.ok(data, { pagination });
  },
);
