/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses none
 */
import type { OrganizationId, SpaceId, UserId, UserWithRelations } from '@template/db';
import {
  createPermissions,
  getOrgPermissions,
  getSpacePermissions,
  getUserPermissions,
  isSuperadmin,
  type Permix,
} from '@template/permissions';
import type { GrantedEntitlements } from '#/lib/context/types';
import { setupEntitlements } from '#/lib/permissions/setupEntitlements';
import { validateRole } from '#/lib/permissions/validateRole';

export const buildUserPermix = async (
  user: UserWithRelations | null,
  _jwtGrant: GrantedEntitlements | null = null,
): Promise<Permix> => {
  const permix = createPermissions();
  if (!user) return permix;
  permix.setSuperadmin(isSuperadmin(user));
  await permix.setup(getUserPermissions(user.id as UserId, 'owner'));

  for (const orgUser of user.organizationUsers) {
    const organizationId = orgUser.organizationId as OrganizationId;
    await permix.setup(getOrgPermissions(validateRole(orgUser.role), organizationId));
    await setupEntitlements(permix, orgUser.entitlements, {
      ownerKey: `db:organization:${organizationId}`,
      selfIds: { organization: organizationId, user: orgUser.userId, organizationUser: orgUser.id },
    });
  }

  for (const spaceUser of user.spaceUsers) {
    const spaceId = spaceUser.spaceId as SpaceId;
    await permix.setup(getSpacePermissions(validateRole(spaceUser.role), spaceId));
    await setupEntitlements(permix, spaceUser.entitlements, {
      ownerKey: `db:space:${spaceId}`,
      selfIds: {
        space: spaceId,
        organization: spaceUser.organizationId,
        user: spaceUser.userId,
        spaceUser: spaceUser.id,
      },
    });
  }

  return permix;
};
