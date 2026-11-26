/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses none
 */
import type { Action, Permix, StandardAction } from '@template/permissions/client';

const STANDARD_ACTIONS_IMPLYING: Record<StandardAction, readonly Action[]> = {
  own: ['own'],
  manage: ['own', 'manage'],
  operate: ['own', 'manage', 'operate'],
  read: ['own', 'manage', 'operate', 'read'],
};

const safePermixTable = (permix: Permix): Record<string, Record<string, boolean>> | null => {
  try {
    return permix.getJSON();
  } catch {
    return null;
  }
};

export const permixIdsWithAction = (
  permix: Permix,
  resource: string,
  action: StandardAction,
): string[] => {
  const ids = new Set<string>();
  const covering = STANDARD_ACTIONS_IMPLYING[action];
  const prefix = `${resource}:`;
  const table = safePermixTable(permix);
  if (table) {
    for (const [key, actions] of Object.entries(table)) {
      if (key.startsWith(prefix) && covering.some((candidate) => actions[candidate] === true)) {
        ids.add(key.slice(prefix.length));
      }
    }
  }
  for (const candidate of covering) {
    for (const ent of permix.entitlements(resource, candidate)) {
      if (ent.anchor.resource === resource && ent.anchor.id) ids.add(ent.anchor.id);
    }
  }
  return [...ids];
};
