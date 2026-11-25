/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { sharedWithOwnerWhere } from '#/modules/artifactPermission/lib/sharedWithOwnerWhere';
import { spaceReadManyArtifactPermissionsRoute } from '#/modules/space/routes/spaceReadManyArtifactPermissions';

export const spaceReadManyArtifactPermissionsController = makeController(
  spaceReadManyArtifactPermissionsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const space = contextResource<'space'>(c);
    const { data, pagination } = await paginate(c, db.artifactPermission, {
      where: sharedWithOwnerWhere({
        ownerModel: 'Space',
        organizationId: space.organizationId,
        spaceId: space.id,
      }),
      include: { artifact: true },
      orderBy: { createdAt: 'desc' },
    });
    return respond.ok(data, { pagination });
  },
);
