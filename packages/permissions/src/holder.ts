/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import type { Entitlements } from '@inixiative/permissions';
import type { Role } from '@template/db/generated/client/enums';
import { rebacSchema } from '@template/permissions/rebac/schema';
import { membershipRoles } from '@template/permissions/roles/membership';
import { organizationRoles } from '@template/permissions/roles/organization';
import { spaceRoles } from '@template/permissions/roles/space';
import { userRoles } from '@template/permissions/roles/user';

export {
  BindError,
  type BindRoots,
  createInterpolator,
  entitlementEntries,
  parseGrantKey,
} from '@inixiative/permissions';

export type GrantResource =
  | 'db:user'
  | 'db:organization'
  | 'db:space'
  | 'db:organizationUser'
  | 'db:spaceUser';

export type SelfModel =
  | 'user'
  | 'organization'
  | 'space'
  | 'organizationUser'
  | 'spaceUser'
  | 'integration';

export type SelfIds = Partial<Record<SelfModel, string>>;

export const SELF = 'self';

export const resolveSelfKeys = (entitlements: Entitlements, selfIds: SelfIds): Entitlements => {
  if (!entitlements) return null;
  const resolved: NonNullable<Entitlements> = {};
  for (const [key, actions] of Object.entries(entitlements)) {
    const [map, model, id] = key.split(':');
    if (id !== SELF) {
      resolved[key] = actions;
      continue;
    }
    const selfId = selfIds[model as SelfModel];
    resolved[selfId ? `${map}:${model}:${selfId}` : key] = actions;
  }
  return resolved;
};

export const isFlatEntitlements = (value: unknown): value is Record<string, boolean> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const held = Object.values(value as Record<string, unknown>);
  return held.length > 0 && held.every((v) => typeof v === 'boolean');
};

export const normalizeEntitlements = (value: unknown, ownerKey: string): Entitlements => {
  if (!value || typeof value !== 'object' || !Object.keys(value).length) return null;
  if (!isFlatEntitlements(value)) return value as Entitlements;
  const actions = Object.fromEntries(
    Object.entries(value)
      .filter(([, held]) => held)
      .map(([action]) => [action, true as const]),
  );
  return Object.keys(actions).length ? { [ownerKey]: actions } : null;
};

const roleActions: Record<GrantResource, (role: Role) => Record<string, boolean>> = {
  'db:user': (role) => userRoles[role].user,
  'db:organization': (role) => organizationRoles[role].organization,
  'db:space': (role) => spaceRoles[role].space,
  'db:organizationUser': (role) => membershipRoles[role].membership,
  'db:spaceUser': (role) => membershipRoles[role].membership,
};

export const roleReaches = (
  resource: GrantResource,
  role: Role,
  action: string,
  seen = new Set<string>(),
): boolean => {
  if (roleActions[resource](role)[action] === true) return true;
  if (seen.has(action)) return false;
  seen.add(action);
  const rule = rebacSchema.permissions[resource]?.actions[action];
  return typeof rule === 'string' && roleReaches(resource, role, rule, seen);
};
