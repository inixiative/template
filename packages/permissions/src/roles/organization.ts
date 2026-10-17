/**
 * @atlas
 * @kind registry
 * @partOf primitive:authz
 * @uses feature:tenancy
 */
import type { OrganizationId } from '@template/db';
import type { Role } from '@template/db/generated/client/enums';
import type { Entitlements, PermissionEntry } from '@template/permissions/client';
import { grantActions } from '@template/permissions/roles/shared';

export const organizationRoles = {
  owner: { organization: { own: true } },
  admin: { organization: { manage: true } },
  member: { organization: { operate: true } },
  viewer: { organization: { read: true } },
} as const;

export const getOrgPermissions = (
  role: Role,
  orgId: OrganizationId,
  entitlements?: Entitlements,
  entitlementsOnly = false,
): PermissionEntry => {
  const baseActions = organizationRoles[role].organization;
  return {
    resource: 'db:organization',
    id: orgId,
    actions: grantActions(baseActions, entitlements, entitlementsOnly),
  };
};
