/**
 * @atlas
 * @kind registry
 * @partOf primitive:authz
 * @uses feature:tenancy
 */
import type { SpaceId } from '@template/db';
import type { Role } from '@template/db/generated/client/enums';
import type { Entitlements, PermissionEntry } from '@template/permissions/client';

export const spaceRoles = {
  owner: { space: { own: true } },
  admin: { space: { manage: true } },
  member: { space: { operate: true } },
  viewer: { space: { read: true } },
} as const;

export const getSpacePermissions = (role: Role, spaceId: SpaceId, entitlements?: Entitlements): PermissionEntry => {
  const baseActions = spaceRoles[role].space;
  return {
    resource: 'db:space',
    id: spaceId,
    actions: { ...baseActions, ...entitlements },
  };
};
