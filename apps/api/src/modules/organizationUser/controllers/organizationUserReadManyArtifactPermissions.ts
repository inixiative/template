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
} from '#/modules/artifactPermission/queries/sharedWithOwnerWhere';
import { organizationUserReadManyArtifactPermissionsRoute } from '#/modules/organizationUser/routes/organizationUserReadManyArtifactPermissions';

export const organizationUserReadManyArtifactPermissionsController = makeController(
  organizationUserReadManyArtifactPermissionsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const member = contextResource<'organizationUser'>(c);
    const owner = {
      ownerModel: 'OrganizationUser' as const,
      organizationId: member.organizationId,
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
