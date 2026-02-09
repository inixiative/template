import type { User } from '@template/db/generated/client/client';
import { PlatformRole, Role } from '@template/db/generated/client/enums';
import type { Action, Entitlements } from '@template/permissions/client';
import { compact } from 'lodash-es';

export const isSuperadmin = (user?: Pick<User, 'platformRole'> | null) =>
  user?.platformRole === PlatformRole.superadmin;

/**
 * Role hierarchy for comparison.
 * Higher index = more permissions.
 */
export const roleHierarchy = ['viewer', 'member', 'admin', 'owner'] as const;

/**
 * Return the lesser of N roles (lower in hierarchy = fewer permissions).
 */
export const lesserRole = (...roles: (Role | null | undefined)[]): Role => {
  const valid = compact(roles);
  if (!valid.length) return 'viewer';
  return valid.reduce((min, role) => (roleHierarchy.indexOf(role) < roleHierarchy.indexOf(min) ? role : min));
};

/**
 * Return the greater of N roles (higher in hierarchy = more permissions).
 */
export const greaterRole = (...roles: (Role | null | undefined)[]): Role => {
  const valid = compact(roles);
  if (!valid.length) return 'viewer';
  return valid.reduce((max, role) => (roleHierarchy.indexOf(role) > roleHierarchy.indexOf(max) ? role : max));
};

/**
 * Intersect N entitlements. Only keys true in ALL are kept.
 */
export const intersectEntitlements = (...entitlements: (Entitlements | undefined)[]): Entitlements => {
  const valid = compact(entitlements);
  if (!valid.length) return null;
  if (valid.length === 1) return valid[0];

  const result: Record<string, boolean> = {};
  for (const key of Object.keys(valid[0])) {
    if (valid.every((e) => e[key])) result[key] = true;
  }
  return Object.keys(result).length ? result : null;
};

/** Map all keys of an action object to true (self-expanding) */
export const allTrue = <T extends Record<string, string>>(actions: T): Record<keyof T, boolean> =>
  Object.fromEntries(Object.keys(actions).map((k) => [k, true])) as Record<keyof T, boolean>;

const roleActionMap: Record<Role, Action> = {
  [Role.owner]: 'own',
  [Role.admin]: 'manage',
  [Role.member]: 'operate',
  [Role.viewer]: 'read',
};

export const roleToStandardAction = (role: Role): Action => roleActionMap[role];
