import type { UserId } from '@template/db';
import type { Role, User } from '@template/db/generated/client/client';
import { UserAction, type Entitlements, type PermissionEntry, type Permix } from '@template/permissions/client';
import { allTrue, isSuperadmin } from './shared';

export const userRoles = {
  owner: { user: { own: true } },
  admin: { user: { manage: true } },
  member: { user: { operate: true } },
  viewer: { user: { read: true } },
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
