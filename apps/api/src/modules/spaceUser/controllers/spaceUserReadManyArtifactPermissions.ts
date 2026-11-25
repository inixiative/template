/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { sharedWithOwnerWhere } from '#/modules/artifactPermission/lib/sharedWithOwnerWhere';
import { spaceUserReadManyArtifactPermissionsRoute } from '#/modules/spaceUser/routes/spaceUserReadManyArtifactPermissions';

export const spaceUserReadManyArtifactPermissionsController = makeController(
  spaceUserReadManyArtifactPermissionsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const member = contextResource<'spaceUser'>(c);
    const { data, pagination } = await paginate(c, db.artifactPermission, {
      where: sharedWithOwnerWhere({
        ownerModel: 'SpaceUser',
        organizationId: member.organizationId,
        spaceId: member.spaceId,
        userId: member.userId,
      }),
      include: { artifact: true },
      orderBy: { createdAt: 'desc' },
    });
    return respond.ok(data, { pagination });
  },
);
