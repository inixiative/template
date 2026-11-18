/**
 * @atlas
 * @kind registry
 * @partOf primitive:authz
 * @uses feature:users
 */
import type { PermissionEntry } from '@template/permissions/client';

export const permissionEntryForOwnUser = (userId: string): PermissionEntry => ({
  resource: 'db:user',
  id: userId,
  actions: { own: true },
});
