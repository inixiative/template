import { SpaceRole, type OrganizationId, type SpaceId, type User } from '@template/db';
import { SpaceAction, type Entitlements, type PermissionEntry, type Permix } from '@template/permissions/client';
import { allTrue, isSuperadmin } from './shared';

export const spaceRoles = {
  owner: { space: allTrue(SpaceAction) },
  admin: { space: { read: true, operate: true, manage: true, own: false } },
  member: { space: { read: true, operate: true, manage: false, own: false } },
  viewer: { space: { read: true, operate: false, manage: false, own: false } },
} as const;

export function getSpacePermissions(
  role: SpaceRole,
  spaceId: SpaceId,
  entitlements?: Entitlements,
  organizationId?: OrganizationId,
): PermissionEntry {
  const baseActions = spaceRoles[role].space;
  return {
    resource: 'space',
    id: spaceId,
    actions: { ...baseActions, ...entitlements },
    context: organizationId ? { organizationId } : undefined,
  };
}

type SpaceContextParams = {
  user?: Pick<User, 'platformRole'> | null;
  role: SpaceRole;
  spaceId: SpaceId;
  entitlements?: Entitlements;
  organizationId?: OrganizationId;
};

export async function setupSpaceContext(
  permix: Permix,
  params: SpaceContextParams,
): Promise<void> {
  if (isSuperadmin(params.user)) {
    permix.setSuperadmin(true);
    return;
  }

  await permix.setup(
    getSpacePermissions(params.role, params.spaceId, params.entitlements, params.organizationId),
  );
}

const roleActionMap: Record<SpaceRole, SpaceAction> = {
  [SpaceRole.owner]: 'own',
  [SpaceRole.admin]: 'manage',
  [SpaceRole.member]: 'operate',
  [SpaceRole.viewer]: 'read',
};

export const roleToSpaceAction = (role: SpaceRole): SpaceAction => roleActionMap[role];
