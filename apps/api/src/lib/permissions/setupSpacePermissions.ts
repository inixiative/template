/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { SpaceId } from '@template/db';
import {
  capGrant,
  type Entitlements,
  getSpacePermissions,
  type Permix,
} from '@template/permissions';
import { membershipGrant } from '#/lib/permissions/membershipGrant';
import type { PermissionPrincipal } from '#/lib/permissions/permissionPrincipal';
import { validateRole } from '#/lib/permissions/validateRole';

export const setupSpacePermissions = async (permix: Permix, principal: PermissionPrincipal) => {
  const { token } = principal;

  if (token?.ownerModel === 'Space' && token.spaceId) {
    await permix.setup(
      getSpacePermissions(
        validateRole(token.role),
        token.spaceId as SpaceId,
        token.entitlements as Entitlements,
        token.entitlementsOnly,
      ),
    );
    return;
  }

  if (token?.ownerModel === 'Organization') return;

  const spaceUsers =
    token?.ownerModel === 'SpaceUser'
      ? (principal.user?.spaceUsers ?? []).filter((su) => su.spaceId === token.spaceId)
      : token?.ownerModel === 'OrganizationUser'
        ? []
        : (principal.user?.spaceUsers ?? []);
  const principalGrant = principal.grant;

  for (const spaceUser of spaceUsers) {
    const membership = membershipGrant(spaceUser);
    const grant = principalGrant
      ? capGrant('db:space', membership, principalGrant)
      : { ...membership, entitlementsOnly: false };
    await permix.setup(
      getSpacePermissions(
        grant.role,
        spaceUser.spaceId as SpaceId,
        grant.entitlements,
        grant.entitlementsOnly,
      ),
    );
  }
};
