/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { actingUser } from '#/lib/context/actingUser';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import {
  assertCanReadSharedArtifactPermissions,
  defaultSharedPermissionOrderBy,
  sharedWithOwnerWhere,
} from '#/modules/artifactPermission/queries/sharedWithOwnerWhere';
import { meReadManyArtifactPermissionsRoute } from '#/modules/me/routes/meReadManyArtifactPermissions';

export const meReadManyArtifactPermissionsController = makeController(
  meReadManyArtifactPermissionsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const owner = { ownerModel: 'User' as const, userId: actingUser(c)!.id };
    await assertCanReadSharedArtifactPermissions(c, owner);
    const { data, pagination } = await paginate(c, db.artifactPermission, {
      where: sharedWithOwnerWhere(owner),
      include: { artifact: true },
      orderBy: defaultSharedPermissionOrderBy(c),
    });
    return respond.ok(data, { pagination });
  },
);
