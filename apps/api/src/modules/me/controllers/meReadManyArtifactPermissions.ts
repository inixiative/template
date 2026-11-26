/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { ownerArtifactPermissionsQuery } from '#/modules/artifactPermission/queries/sharedWithOwnerWhere';
import { meReadManyArtifactPermissionsRoute } from '#/modules/me/routes/meReadManyArtifactPermissions';

export const meReadManyArtifactPermissionsController = makeController(
  meReadManyArtifactPermissionsRoute,
  async (c, respond) => {
    const { data, pagination } = await paginate(
      c,
      c.get('db').artifactPermission,
      await ownerArtifactPermissionsQuery(c),
    );
    return respond.ok(data, { pagination });
  },
);
