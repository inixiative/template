import type { SpaceId } from '@template/db';
import { SpaceRole } from '@template/db/generated/client/enums';
import { SpaceAction, type Entitlements, type PermissionEntry, type Permix } from '@template/permissions/client';
import { allTrue } from './shared';

export const spaceRoles = {
  owner: { space: { own: true } },
  admin: { space: { manage: true } },
  member: { space: { operate: true } },
  viewer: { space: { read: true } },
} as const;

export function getSpacePermissions(
  role: SpaceRole,
  spaceId: SpaceId,
  entitlements?: Entitlements,
): PermissionEntry {
  const baseActions = spaceRoles[role].space;
  return {
    resource: 'space',
    id: spaceId,
    actions: { ...baseActions, ...entitlements },
  };
}

type SpaceContextParams = {
  role: SpaceRole;
  spaceId: SpaceId;
  entitlements?: Entitlements;
};

export async function setupSpaceContext(
  permix: Permix,
  params: SpaceContextParams,
): Promise<void> {
  await permix.setup(getSpacePermissions(params.role, params.spaceId, params.entitlements));
}
