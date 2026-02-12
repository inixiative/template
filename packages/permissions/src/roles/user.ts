import type { UserId } from '@template/db';
import type { Role, User } from '@template/db/generated/client/client';
import { type Entitlements, type PermissionEntry, type Permix, UserAction } from '@template/permissions/client';
import { allTrue, isSuperadmin } from '@template/permissions/roles/shared';

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
): PermissionEntry => {
  const baseActions = userRoles[role].user;
  return {
    resource: 'user',
    id: userId,
    actions: { ...baseActions, ...entitlements },
  };
};

