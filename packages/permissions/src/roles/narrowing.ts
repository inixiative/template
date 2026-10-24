/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import type { Role } from '@template/db/generated/client/enums';
import type { Entitlements, PermissionEntry } from '@template/permissions/client';
import { roleHierarchy, roleToStandardAction } from '@template/permissions/roles/shared';

const named = (entitlements: Entitlements | undefined): Record<string, true> =>
  Object.fromEntries(
    Object.entries(entitlements ?? {})
      .filter(([, held]) => held === true)
      .map(([action]) => [action, true as const]),
  );

// An entitlement holds for the action asked, not for one it delegates to, so a role claims every
// action at or below it; the owner's walk then answers each on its own.
const roleActions = (role: Role): Record<string, true> =>
  Object.fromEntries(
    roleHierarchy
      .slice(0, roleHierarchy.indexOf(role) + 1)
      .map((held) => [roleToStandardAction(held), true as const]),
  );

// A credential is a narrowing of its holder: what it claims on a position, installed with the
// holder's table as owner, so the walk caps it live. With no entitlements of its own it inherits
// the holder's, and the owner still decides.
export const narrowing = (
  resource: string,
  id: string,
  role: Role,
  entitlements: Entitlements | undefined,
  inherited: Entitlements | undefined,
): PermissionEntry => ({
  resource,
  from: { resource, id },
  actions: { ...roleActions(role), ...named(entitlements ?? inherited) },
});
