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
import { organizationReadManyArtifactPermissionsRoute } from '#/modules/organization/routes/organizationReadManyArtifactPermissions';

export const organizationReadManyArtifactPermissionsController = makeController(
  organizationReadManyArtifactPermissionsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const organization = contextResource<'organization'>(c);
    const { data, pagination } = await paginate(c, db.artifactPermission, {
      where: sharedWithOwnerWhere({
        ownerModel: 'Organization',
        organizationId: organization.id,
      }),
      include: { artifact: true },
      orderBy: { createdAt: 'desc' },
    });
    return respond.ok(data, { pagination });
  },
);
