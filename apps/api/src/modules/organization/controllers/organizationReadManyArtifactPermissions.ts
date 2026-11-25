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
  defaultSharedPermissionOrderBy,
  sharedWithOwnerWhere,
  validateCanReadSharedArtifactPermissions,
} from '#/modules/artifactPermission/queries/sharedWithOwnerWhere';
import { organizationReadManyArtifactPermissionsRoute } from '#/modules/organization/routes/organizationReadManyArtifactPermissions';

export const organizationReadManyArtifactPermissionsController = makeController(
  organizationReadManyArtifactPermissionsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const owner = {
      ownerModel: 'Organization' as const,
      organizationId: contextResource<'organization'>(c).id,
    };
    await validateCanReadSharedArtifactPermissions(c, owner);
    const { data, pagination } = await paginate(c, db.artifactPermission, {
      where: sharedWithOwnerWhere(owner),
      include: { artifact: true },
      orderBy: defaultSharedPermissionOrderBy(c),
    });
    return respond.ok(data, { pagination });
  },
);
