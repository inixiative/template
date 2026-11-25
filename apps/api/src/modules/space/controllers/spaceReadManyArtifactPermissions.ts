/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import {
  assertCanReadSharedArtifactPermissions,
  defaultSharedPermissionOrderBy,
  sharedWithOwnerWhere,
} from '#/modules/artifactPermission/queries/sharedWithOwnerWhere';
import { spaceReadManyArtifactPermissionsRoute } from '#/modules/space/routes/spaceReadManyArtifactPermissions';

export const spaceReadManyArtifactPermissionsController = makeController(
  spaceReadManyArtifactPermissionsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const space = contextResource<'space'>(c);
    const owner = {
      ownerModel: 'Space' as const,
      organizationId: space.organizationId,
      spaceId: space.id,
    };
    await assertCanReadSharedArtifactPermissions(c, owner);
    const { data, pagination } = await paginate(c, db.artifactPermission, {
      where: sharedWithOwnerWhere(owner),
      include: { artifact: true },
      orderBy: defaultSharedPermissionOrderBy(c),
    });
    return respond.ok(data, { pagination });
  },
);
