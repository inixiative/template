/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses none
 */
import type { OrganizationId, SpaceId, UserId, UserWithRelations } from '@template/db';
import {
  getMembershipPermissions,
  getOrgPermissions,
  getSpacePermissions,
  getUserPermissions,
  type Permix,
  UserAction,
  userLoginGrant,
} from '@template/permissions';
import { membershipGrant } from '#/lib/permissions/membershipGrant';

export const setupPersonPermissions = async (permix: Permix, user: UserWithRelations) => {
  await permix.setup([
    getUserPermissions(user.id as UserId, userLoginGrant.role, {
      ...userLoginGrant.entitlements,
      [UserAction.identify]: true,
    }),
    ...user.organizationUsers.map((organizationUser) => {
      const { role, entitlements } = membershipGrant(organizationUser);
      return getOrgPermissions(
        role,
        organizationUser.organizationId as OrganizationId,
        entitlements,
      );
    }),
    ...user.spaceUsers.map((spaceUser) => {
      const { role, entitlements } = membershipGrant(spaceUser);
      return getSpacePermissions(role, spaceUser.spaceId as SpaceId, entitlements);
    }),
    ...user.organizationUsers.map(({ id }) =>
      getMembershipPermissions('db:organizationUser', 'owner', id),
    ),
    ...user.spaceUsers.map(({ id }) => getMembershipPermissions('db:spaceUser', 'owner', id)),
  ]);
};
