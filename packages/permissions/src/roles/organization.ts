/**
 * @atlas
 * @kind registry
 * @partOf primitive:authz
 * @uses feature:tenancy
 */
import type { Role } from '@template/db/generated/client/enums';
import type { PermissionEntry } from '@template/permissions/client';

export const organizationRoles = {
  owner: { organization: { own: true } },
  admin: { organization: { manage: true } },
  member: { organization: { operate: true } },
  viewer: { organization: { read: true } },
} as const;

export const getOrgPermissions = (role: Role, orgId: string): PermissionEntry => {
  const baseActions = organizationRoles[role].organization;
  return {
    resource: 'db:organization',
    id: orgId,
    actions: baseActions,
  };
};
