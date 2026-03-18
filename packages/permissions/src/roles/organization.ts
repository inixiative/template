import type { OrganizationId } from '@template/db';
import type { Role } from '@template/db/generated/client/enums';
import type { Entitlements, PermissionEntry } from '@template/permissions/client';

export const organizationRoles = {
  owner: { organization: { own: true } },
  admin: { organization: { manage: true } },
  member: { organization: { operate: true } },
  viewer: { organization: { read: true } },
} as const;

export const getOrgPermissions = (role: Role, orgId: OrganizationId, entitlements?: Entitlements): PermissionEntry => {
  const baseActions = organizationRoles[role].organization;
  return {
    resource: 'organization',
    id: orgId,
    actions: { ...baseActions, ...entitlements },
  };
};
