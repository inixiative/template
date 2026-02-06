import type { OrganizationId } from '@template/db';
import { Role } from '@template/db/generated/client/enums';
import type { User } from '@template/db/generated/client/client';
import { OrganizationAction, type Entitlements, type PermissionEntry, type Permix } from '@template/permissions/client';
import { allTrue, isSuperadmin } from './shared';

export const organizationRoles = {
  owner: { organization: { own: true} },
  admin: { organization: { manage: true } },
  member: { organization: { operate: true} },
  viewer: { organization: { read: true } },
} as const;

export function getOrgPermissions(
  role: Role,
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
  role: Role;
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

