/**
 * @atlas
 * @kind registry
 * @partOf primitive:authz
 * @uses feature:users
 */
import type { UserId } from '@template/db';
import type { Role } from '@template/db/generated/client/client';
import type { Entitlements, PermissionEntry } from '@template/permissions/client';
import { grantActions } from '@template/permissions/roles/shared';

export const userRoles = {
  owner: { user: { own: true } },
  admin: { user: { manage: true } },
  member: { user: { operate: true } },
  viewer: { user: { read: true } },
} as const;

export const getUserPermissions = (
  userId: UserId,
  role: Role = 'owner',
  entitlements?: Entitlements,
  entitlementsOnly = false,
): PermissionEntry => {
  const baseActions = userRoles[role].user;
  return {
    resource: 'db:user',
    id: userId,
    actions: grantActions(baseActions, entitlements, entitlementsOnly),
  };
};
