/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import type { Role } from '@template/db/generated/client/enums';
import type { EntitlementEntry } from '@template/permissions/client';
import { roleHierarchy, roleToStandardAction } from '@template/permissions/roles/shared';

// An entitlement holds for the action asked, not for one it delegates to, so a role names every
// action at or below it; the owner's walk then answers each on its own.
const roleActions = (role: Role): Record<string, true> =>
  Object.fromEntries(
    roleHierarchy
      .slice(0, roleHierarchy.indexOf(role) + 1)
      .map((held) => [roleToStandardAction(held), true as const]),
  );

export const narrowing = (resource: string, id: string, role: Role): EntitlementEntry => ({
  resource,
  anchor: { resource, id },
  actions: roleActions(role),
});
