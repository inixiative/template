/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses none
 */
import type { Entitlement } from '@inixiative/permissions';
import type { Action, Permix, StandardAction } from '@template/permissions/client';

export const STANDARD_ACTIONS_IMPLYING: Record<StandardAction, readonly Action[]> = {
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

export const directEntitledIds = (
  permix: Permix,
  resource: string,
  actions: readonly Action[],
): { entitlements: Entitlement[]; directIds: string[]; hasBroadEntitlement: boolean } => {
  const entitlements = actions.flatMap((action) => permix.entitlements(resource, action));
  const directIds = [
    ...new Set(
      entitlements.flatMap((ent) =>
        ent.anchor.resource === resource && ent.anchor.id ? [ent.anchor.id] : [],
      ),
    ),
  ];
  return {
    entitlements,
    directIds,
    hasBroadEntitlement: entitlements.some(
      (ent) => ent.anchor.resource !== resource || !ent.anchor.id,
    ),
  };
};

// Reads the caller's already-resolved effective permissions (covering users, full/capped/entitlement-only
// tokens, member-seat tokens, integration tokens, and spoofing) without duplicating ownerPermissions.
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
  for (const id of directEntitledIds(permix, resource, covering).directIds) ids.add(id);
  return [...ids];
};
