/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import type { User } from '@template/db/generated/client/client';
import { PlatformRole, Role } from '@template/db/generated/client/enums';
import type { Action } from '@template/permissions/client';

export const isSuperadmin = (user?: Pick<User, 'platformRole'> | null) =>
  user?.platformRole === PlatformRole.superadmin;

export const roleHierarchy = ['viewer', 'member', 'admin', 'owner'] as const;

const roleActionMap: Record<Role, Action> = {
  [Role.owner]: 'own',
  [Role.admin]: 'manage',
  [Role.member]: 'operate',
  [Role.viewer]: 'read',
};

export const roleToStandardAction = (role: Role): Action => roleActionMap[role];
