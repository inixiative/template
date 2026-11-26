/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifactPermissions } from '#/modules/artifactPermission/queries/sharedWithOwnerWhere';
import { organizationUserReadManyArtifactPermissionsRoute } from '#/modules/organizationUser/routes/organizationUserReadManyArtifactPermissions';

export const organizationUserReadManyArtifactPermissionsController = makeController(
  organizationUserReadManyArtifactPermissionsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginateOwnerArtifactPermissions(c);
    return respond.ok(data, { pagination });
  },
);
