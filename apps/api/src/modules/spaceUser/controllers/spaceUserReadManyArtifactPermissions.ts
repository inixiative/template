/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { paginateSharedArtifactPermissions } from '#/modules/artifactPermission/lib/sharedWithOwnerWhere';
import { spaceUserReadManyArtifactPermissionsRoute } from '#/modules/spaceUser/routes/spaceUserReadManyArtifactPermissions';

export const spaceUserReadManyArtifactPermissionsController = makeController(
  spaceUserReadManyArtifactPermissionsRoute,
  async (c, respond) => {
    const member = contextResource<'spaceUser'>(c);
    const { data, pagination } = await paginateSharedArtifactPermissions(c, {
      ownerModel: 'SpaceUser',
      organizationId: member.organizationId,
      spaceId: member.spaceId,
      userId: member.userId,
    });
    return respond.ok(data, { pagination });
  },
);
