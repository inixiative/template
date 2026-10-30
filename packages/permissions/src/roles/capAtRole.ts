/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import { reachableFrom } from '@inixiative/permissions';
import type { Role } from '@template/db/generated/client/enums';
import type { PermissionEntry } from '@template/permissions/client';
import { rebacSchema } from '@template/permissions/rebac/schema';
import { roleHierarchy, roleToStandardAction } from '@template/permissions/roles/shared';

const standardActions: string[] = roleHierarchy.map(roleToStandardAction);

export const capAtRole = (entry: PermissionEntry, role: Role): PermissionEntry | null => {
  const ceiling = standardActions.indexOf(roleToStandardAction(role));
  const held = (action: string) => entry.actions[action as never] === true;
  const kept = standardActions
    .slice(0, ceiling + 1)
    .filter((action) => [...reachableFrom(rebacSchema, entry.resource, action)].some(held));
  return kept.length
    ? { ...entry, actions: Object.fromEntries(kept.map((action) => [action, true])) }
    : null;
};
