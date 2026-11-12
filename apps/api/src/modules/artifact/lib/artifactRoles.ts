/**
 * @atlas
 * @kind helper
 * @partOf feature:files
 * @uses primitive:authz
 */
import type { Role } from '@template/db/generated/client/enums';
import type { StandardAction } from '@template/permissions/client';
import { roleHierarchy } from '@template/permissions/roles/shared';

const roleForAction: Record<StandardAction, Role> = {
  read: 'viewer',
  operate: 'member',
  manage: 'admin',
  own: 'owner',
};

const rank = (role: Role) => roleHierarchy.indexOf(role);

export const roleAllows = (role: Role | null, action: StandardAction): boolean =>
  role !== null && rank(role) >= rank(roleForAction[action]);

export const strongerRole = (current: Role | null, next: Role | null): Role | null =>
  current && next ? (rank(current) >= rank(next) ? current : next) : (current ?? next);

export const cappedRole = (role: Role, cap: Role | null): Role | null =>
  cap ? (rank(role) <= rank(cap) ? role : cap) : null;
