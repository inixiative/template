/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { actingUser } from '#/lib/context/actingUser';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { sharedWithOwnerWhere } from '#/modules/artifactPermission/lib/sharedWithOwnerWhere';
import { meReadManyArtifactPermissionsRoute } from '#/modules/me/routes/meReadManyArtifactPermissions';

export const meReadManyArtifactPermissionsController = makeController(
  meReadManyArtifactPermissionsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate(c, db.artifactPermission, {
      where: sharedWithOwnerWhere({ ownerModel: 'User', userId: actingUser(c)!.id }),
      include: { artifact: true },
      orderBy: { createdAt: 'desc' },
    });
    return respond.ok(data, { pagination });
  },
);
