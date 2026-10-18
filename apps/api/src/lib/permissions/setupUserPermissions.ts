/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { UserId } from '@template/db';
import type { Permix } from '@template/permissions';
import { capGrant, getUserPermissions, UserAction, userLoginGrant } from '@template/permissions';
import type { PermissionPrincipal } from '#/lib/permissions/permissionPrincipal';

const membershipTokenModels = ['OrganizationUser', 'SpaceUser'];

export const setupUserPermissions = async (permix: Permix, principal: PermissionPrincipal) => {
  const { user, token } = principal;
  if (!user) return;

  if (token && membershipTokenModels.includes(token.ownerModel)) {
    await permix.setup(
      getUserPermissions(user.id as UserId, 'viewer', { [UserAction.identify]: true }, true),
    );
    return;
  }

  const principalGrant = principal.grant;
  const grant = principalGrant
    ? capGrant('db:user', userLoginGrant, principalGrant)
    : { ...userLoginGrant, entitlementsOnly: false };

  await permix.setup(
    getUserPermissions(
      user.id as UserId,
      grant.role,
      { ...grant.entitlements, [UserAction.identify]: true },
      grant.entitlementsOnly,
    ),
  );
};
