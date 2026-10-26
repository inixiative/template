/**
 * @atlas
 * @kind registry
 * @partOf primitive:authz
 * @uses feature:users
 */
import type { UserId } from '@template/db';
import type { PermissionEntry } from '@template/permissions/client';

export const getUserPermissions = (userId: UserId): PermissionEntry => ({
  resource: 'db:user',
  id: userId,
  actions: { own: true },
});
