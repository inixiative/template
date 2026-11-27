/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { ownerArtifactPermissionsQuery } from '#/modules/artifactPermission/queries/sharedWithOwnerWhere';
import { spaceUserReadManyArtifactPermissionsRoute } from '#/modules/spaceUser/routes/spaceUserReadManyArtifactPermissions';

export const spaceUserReadManyArtifactPermissionsController = makeController(
  spaceUserReadManyArtifactPermissionsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginate(
      c,
      c.get('db').artifactPermission,
      await ownerArtifactPermissionsQuery(c),
    );
    return respond.ok(data, { pagination });
  },
);
