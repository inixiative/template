/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { OrganizationId } from '@template/db';
import {
  capGrant,
  type Entitlements,
  getMembershipPermissions,
  getOrgPermissions,
  type Permix,
} from '@template/permissions';
import { membershipGrant, membershipSelfGrant } from '#/lib/permissions/membershipGrant';
import type { PermissionPrincipal } from '#/lib/permissions/permissionPrincipal';
import { validateRole } from '#/lib/permissions/validateRole';

export const setupOrgPermissions = async (permix: Permix, principal: PermissionPrincipal) => {
  const { token } = principal;

  if (token?.ownerModel === 'Organization' && token.organizationId) {
    await permix.setup(
      getOrgPermissions(
        validateRole(token.role),
        token.organizationId as OrganizationId,
        token.entitlements as Entitlements,
        token.entitlementsOnly,
      ),
    );
    return;
  }

  if (token?.ownerModel === 'Space' || token?.ownerModel === 'SpaceUser') return;

  const orgUsers =
    token?.ownerModel === 'OrganizationUser'
      ? (principal.user?.organizationUsers ?? []).filter(
          (ou) => ou.organizationId === token.organizationId,
        )
      : (principal.user?.organizationUsers ?? []);
  const principalGrant = principal.grant;

  for (const orgUser of orgUsers) {
    const membership = membershipGrant(orgUser);
    const grant = principalGrant
      ? capGrant('db:organization', membership, principalGrant)
      : { ...membership, entitlementsOnly: false };
    await permix.setup(
      getOrgPermissions(
        grant.role,
        orgUser.organizationId as OrganizationId,
        grant.entitlements,
        grant.entitlementsOnly,
      ),
    );
    if (token?.ownerModel === 'OrganizationUser' && principalGrant) {
      const self = capGrant('db:organizationUser', membershipSelfGrant, principalGrant);
      await permix.setup(
        getMembershipPermissions(
          'db:organizationUser',
          self.role,
          orgUser.id,
          self.entitlements,
          self.entitlementsOnly,
        ),
      );
    }
  }
};
