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
import { organizationUserReadManyArtifactPermissionsRoute } from '#/modules/organizationUser/routes/organizationUserReadManyArtifactPermissions';

export const organizationUserReadManyArtifactPermissionsController = makeController(
  organizationUserReadManyArtifactPermissionsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const member = contextResource<'organizationUser'>(c);
    const { data, pagination } = await paginate(c, db.artifactPermission, {
      where: sharedWithOwnerWhere({
        ownerModel: 'OrganizationUser',
        organizationId: member.organizationId,
        userId: member.userId,
      }),
      include: { artifact: true },
      orderBy: { createdAt: 'desc' },
    });
    return respond.ok(data, { pagination });
  },
);
