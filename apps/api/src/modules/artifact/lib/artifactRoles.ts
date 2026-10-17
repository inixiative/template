/**
 * @atlas
 * @kind helper
 * @partOf feature:files
 * @uses primitive:authz
 */
import type { Role } from '@template/db/generated/client/enums';
import { greaterRole, lesserRole, roleHierarchy } from '@template/permissions';
import type { StandardAction } from '@template/permissions/client';

const roleForAction: Record<StandardAction, Role> = {
  read: 'viewer',
  operate: 'member',
  manage: 'admin',
  own: 'owner',
};

export const roleAllows = (role: Role | null, action: StandardAction): boolean =>
  role !== null && roleHierarchy.indexOf(role) >= roleHierarchy.indexOf(roleForAction[action]);

export const strongerRole = (current: Role | null, next: Role | null): Role | null =>
  current && next ? greaterRole(current, next) : (current ?? next);

export const cappedRole = (role: Role, cap: Role | null): Role | null =>
  cap ? lesserRole(role, cap) : null;
