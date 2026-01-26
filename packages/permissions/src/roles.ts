import { OrganizationRole, PlatformRole, type User, type OrganizationId } from '@template/db';
import type { OrganizationAction, PermissionEntry, Permix, Entitlements } from '@template/permissions/client';

export const isSuperadmin = (user?: Pick<User, 'platformRole'> | null) =>
  user?.platformRole === PlatformRole.superadmin;

export const organizationRoles = {
  owner: {
    organization: { read: true, operate: true, manage: true, own: true },
  },
  admin: {
    organization: { read: true, operate: true, manage: true, own: false },
  },
  member: {
    organization: { read: true, operate: true, manage: false, own: false },
  },
  viewer: {
    organization: { read: true, operate: false, manage: false, own: false },
  },
} as const;

export function getOrgPermissions(
  role: OrganizationRole,
  orgId: OrganizationId,
  entitlements?: Entitlements
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
  params: OrgContextParams
): Promise<void> {
  if (isSuperadmin(params.user)) {
    permix.setSuperadmin(true);
    return;
  }

  await permix.setup(getOrgPermissions(params.role, params.orgId, params.entitlements));
}

/**
 * Role hierarchy for comparison.
 * Higher index = more permissions.
 */
export const roleHierarchy = ['viewer', 'member', 'admin', 'owner'] as const;

/**
 * Return the lesser of two roles (lower in hierarchy = fewer permissions).
 */
export const lesserRole = (
  a?: OrganizationRole | null,
  b?: OrganizationRole | null,
): OrganizationRole => {
  if (!a) return b ?? 'viewer';
  if (!b) return a;
  const aIndex = roleHierarchy.indexOf(a);
  const bIndex = roleHierarchy.indexOf(b);
  return aIndex <= bIndex ? a : b;
};

/**
 * Return the greater of two roles (higher in hierarchy = more permissions).
 */
export const greaterRole = (
  a?: OrganizationRole | null,
  b?: OrganizationRole | null,
): OrganizationRole => {
  if (!a) return b ?? 'viewer';
  if (!b) return a;
  const aIndex = roleHierarchy.indexOf(a);
  const bIndex = roleHierarchy.indexOf(b);
  return aIndex >= bIndex ? a : b;
};

const roleActionMap: Record<OrganizationRole, OrganizationAction> = {
  [OrganizationRole.owner]: 'own',
  [OrganizationRole.admin]: 'manage',
  [OrganizationRole.member]: 'operate',
  [OrganizationRole.viewer]: 'read',
};

export const roleToOrgAction = (role: OrganizationRole): OrganizationAction => roleActionMap[role];

export const intersectEntitlements = (
  a?: Entitlements,
  b?: Entitlements,
): Entitlements => {
  if (!a) return b ?? null;
  if (!b) return a;

  const result: Record<string, boolean> = {};
  for (const key of Object.keys(a)) {
    if (a[key] && b[key]) result[key] = true;
  }
  return Object.keys(result).length ? result : null;
};
