import type { UserId } from '@template/db';
import type { Role, User } from '@template/db/generated/client/client';
import { UserAction, type Entitlements, type PermissionEntry, type Permix } from '@template/permissions/client';
import { allTrue, isSuperadmin } from './shared';

export const userRoles = {
  owner: { user: allTrue(UserAction) },
  admin: { user: { read: true, operate: true, manage: true, own: false } },
  member: { user: { read: true, operate: true, manage: false, own: false } },
  viewer: { user: { read: true, operate: false, manage: false, own: false } },
} as const;

export function getUserPermissions(
  userId: UserId,
  role: Role = 'owner',
  entitlements?: Entitlements,
): PermissionEntry {
  const baseActions = userRoles[role].user;
  return {
    resource: 'user',
    id: userId,
    actions: { ...baseActions, ...entitlements },
  };
}

type UserContextParams = {
  user: Pick<User, 'id' | 'platformRole'>;
  role?: Role;
  entitlements?: Entitlements;
};

/** Set up user permissions. No token = owner, token = restricted by token role. */
export async function setupUserContext(
  permix: Permix,
  params: UserContextParams,
): Promise<void> {
  if (isSuperadmin(params.user)) {
    permix.setSuperadmin(true);
    return;
  }

  await permix.setup(getUserPermissions(params.user.id as UserId, params.role ?? 'owner', params.entitlements));
}
