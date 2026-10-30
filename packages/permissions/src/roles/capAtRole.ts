/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import type { Role } from '@template/db/generated/client/enums';
import type { PermissionEntry } from '@template/permissions/client';
import { roleHierarchy, roleToStandardAction } from '@template/permissions/roles/shared';

const standardActions: string[] = roleHierarchy.map(roleToStandardAction);

export const capAtRole = (entry: PermissionEntry, role: Role): PermissionEntry | null => {
  const ceiling = standardActions.indexOf(roleToStandardAction(role));
  const held = standardActions.filter((action) => entry.actions[action as never] === true);
  const kept = held.filter((action) => standardActions.indexOf(action) <= ceiling);
  if (held.length > kept.length) kept.push(standardActions[ceiling] as string);
  return kept.length
    ? { ...entry, actions: Object.fromEntries(kept.map((action) => [action, true])) }
    : null;
};
