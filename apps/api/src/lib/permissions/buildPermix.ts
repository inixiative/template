/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses none
 */
import type { UserId } from '@template/db';
import { createPermissions, isSuperadmin, type Permix } from '@template/permissions';
import type { PermissionPrincipal } from '#/lib/permissions/permissionPrincipal';
import { setupOrgPermissions } from '#/lib/permissions/setupOrgPermissions';
import { setupSpacePermissions } from '#/lib/permissions/setupSpacePermissions';
import { setupUserPermissions } from '#/lib/permissions/setupUserPermissions';

export const buildPermix = async (principal: PermissionPrincipal): Promise<Permix> => {
  const permix = createPermissions();
  if (principal.user) {
    permix.setUserId(principal.user.id as UserId);
    permix.setSuperadmin(isSuperadmin(principal.user));
  }
  await setupUserPermissions(permix, principal);
  await setupOrgPermissions(permix, principal);
  await setupSpacePermissions(permix, principal);
  return permix;
};
