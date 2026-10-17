/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import type { Role } from '@template/db/generated/client/enums';
import { type ActionState, type Entitlements, SessionAction } from '@template/permissions/client';
import { rebacSchema } from '@template/permissions/rebac/schema';
import { organizationRoles } from '@template/permissions/roles/organization';
import { grantActions, lesserRole } from '@template/permissions/roles/shared';
import { spaceRoles } from '@template/permissions/roles/space';
import { userRoles } from '@template/permissions/roles/user';

export type Grant = { role: Role; entitlements: Entitlements };

export type Slice = Grant & { entitlementsOnly: boolean };

export type GrantResource = 'db:user' | 'db:organization' | 'db:space';

const roleActions: Record<GrantResource, (role: Role) => ActionState> = {
  'db:user': (role) => userRoles[role].user,
  'db:organization': (role) => organizationRoles[role].organization,
  'db:space': (role) => spaceRoles[role].space,
};

const grantAll = (actions: readonly string[]): Entitlements =>
  actions.length ? Object.fromEntries(actions.map((action) => [action, true])) : null;

export const userLoginGrant: Grant = {
  role: 'owner',
  entitlements: grantAll(Object.values(SessionAction)),
};

const holds = (
  resource: GrantResource,
  actions: ActionState,
  action: string,
  seen: Set<string>,
): boolean => {
  if (actions[action as keyof ActionState] === true) return true;
  if (seen.has(action)) return false;
  seen.add(action);
  const rule = rebacSchema.permissions[resource]?.actions[action];
  return typeof rule === 'string' && holds(resource, actions, rule, seen);
};

export const grantReaches = (
  resource: GrantResource,
  grant: Grant & { entitlementsOnly?: boolean },
  action: string,
): boolean =>
  holds(
    resource,
    grantActions(roleActions[resource](grant.role), grant.entitlements, grant.entitlementsOnly),
    action,
    new Set(),
  );

export const capSlice = (resource: GrantResource, owner: Grant, slice: Slice): Slice => {
  const kept = Object.keys(slice.entitlements ?? {}).filter(
    (action) => slice.entitlements?.[action] === true && grantReaches(resource, owner, action),
  );
  const entitlements = grantAll(kept);
  if (slice.entitlementsOnly) return { role: owner.role, entitlements, entitlementsOnly: true };
  return { role: lesserRole(owner.role, slice.role), entitlements, entitlementsOnly: false };
};
