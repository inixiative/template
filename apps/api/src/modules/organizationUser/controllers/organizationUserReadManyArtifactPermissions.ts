/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { paginateSharedArtifactPermissions } from '#/modules/artifactPermission/lib/sharedWithOwnerWhere';
import { organizationUserReadManyArtifactPermissionsRoute } from '#/modules/organizationUser/routes/organizationUserReadManyArtifactPermissions';

export const organizationUserReadManyArtifactPermissionsController = makeController(
  organizationUserReadManyArtifactPermissionsRoute,
  async (c, respond) => {
    const member = contextResource<'organizationUser'>(c);
    const { data, pagination } = await paginateSharedArtifactPermissions(c, {
      ownerModel: 'OrganizationUser',
      organizationId: member.organizationId,
      userId: member.userId,
    });
    return respond.ok(data, { pagination });
  },
);
