/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import { type Entitlements, greaterRole, type Role } from '@template/permissions';

const actionLevel: Record<string, Role> = {
  own: 'owner',
  manage: 'admin',
  operate: 'member',
  read: 'viewer',
};

export const assignLevel = (role: Role | null, entitlements: Entitlements): Role =>
  greaterRole(
    role,
    ...Object.keys(entitlements ?? {})
      .filter((action) => entitlements?.[action] === true)
      .map((action) => actionLevel[action] ?? 'member'),
  );
