/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { ownerArtifactPermissionsQuery } from '#/modules/artifactPermission/queries/sharedWithOwnerWhere';
import { organizationUserReadManyArtifactPermissionsRoute } from '#/modules/organizationUser/routes/organizationUserReadManyArtifactPermissions';

export const organizationUserReadManyArtifactPermissionsController = makeController(
  organizationUserReadManyArtifactPermissionsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginate(
      c,
      c.get('db').artifactPermission,
      await ownerArtifactPermissionsQuery(c),
    );
    return respond.ok(data, { pagination });
  },
);
