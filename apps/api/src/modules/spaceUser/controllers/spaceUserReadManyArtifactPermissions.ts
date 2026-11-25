/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import {
  assertCanReadSharedArtifactPermissions,
  defaultSharedPermissionOrderBy,
  sharedWithOwnerWhere,
} from '#/modules/artifactPermission/lib/sharedWithOwnerWhere';
import { spaceUserReadManyArtifactPermissionsRoute } from '#/modules/spaceUser/routes/spaceUserReadManyArtifactPermissions';

export const spaceUserReadManyArtifactPermissionsController = makeController(
  spaceUserReadManyArtifactPermissionsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const member = contextResource<'spaceUser'>(c);
    const owner = {
      ownerModel: 'SpaceUser' as const,
      organizationId: member.organizationId,
      spaceId: member.spaceId,
      userId: member.userId,
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
