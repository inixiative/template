import { OrganizationRole, type OrganizationId, type User } from '@template/db';
import { OrganizationAction, type Entitlements, type PermissionEntry, type Permix } from '@template/permissions/client';
import { allTrue, isSuperadmin } from './shared';

export const organizationRoles = {
  owner: { organization: allTrue(OrganizationAction) },
  admin: { organization: { read: true, operate: true, manage: true, own: false } },
  member: { organization: { read: true, operate: true, manage: false, own: false } },
  viewer: { organization: { read: true, operate: false, manage: false, own: false } },
} as const;

export function getOrgPermissions(
  role: OrganizationRole,
  orgId: OrganizationId,
  entitlements?: Entitlements,
): PermissionEntry {
  const baseActions = organizationRoles[role].organization;
  return {
    resource: 'organization',
    id: orgId,
    actions: { ...baseActions, ...entitlements },
  };
}

type OrgContextParams = {
  user?: Pick<User, 'platformRole'> | null;
  role: OrganizationRole;
  orgId: OrganizationId;
  entitlements?: Entitlements;
};

export async function setupOrgContext(
  permix: Permix,
  params: OrgContextParams,
): Promise<void> {
  if (isSuperadmin(params.user)) {
    permix.setSuperadmin(true);
    return;
  }

  await permix.setup(getOrgPermissions(params.role, params.orgId, params.entitlements));
}

const roleActionMap: Record<OrganizationRole, OrganizationAction> = {
  [OrganizationRole.owner]: 'own',
  [OrganizationRole.admin]: 'manage',
  [OrganizationRole.member]: 'operate',
  [OrganizationRole.viewer]: 'read',
};

export const roleToOrgAction = (role: OrganizationRole): OrganizationAction => roleActionMap[role];
