/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import type { AccessorName, HydratedRecord } from '@template/db';
import type { Role } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import { type GrantResource, roleReaches } from '@template/permissions/holder';
import { check } from '@template/permissions/rebac/check';
import { rebacSchema } from '@template/permissions/rebac/schema';
import {
  greaterRole,
  roleHierarchy,
  roleToStandardAction,
} from '@template/permissions/roles/shared';

const actionLevel = (resource: GrantResource, action: string): Role => {
  const reachedBy = roleHierarchy.find((role) => roleReaches(resource, role, action));
  if (reachedBy) return reachedBy;
  return rebacSchema.permissions[resource]?.actions[action] === undefined ? 'member' : 'owner';
};

export type NamedEntitlements = Record<string, boolean> | null | undefined;

const namedActions = (entitlements: NamedEntitlements) =>
  Object.keys(entitlements ?? {}).filter((action) => entitlements?.[action] === true);

export const assignLevel = (
  role: Role | null,
  entitlements: NamedEntitlements,
  resource: GrantResource = 'db:organization',
): Role =>
  greaterRole(role, ...namedActions(entitlements).map((action) => actionLevel(resource, action)));

export type AssignTarget = { model: AccessorName; record: HydratedRecord };
export type AssignOwner = { model: 'organization' | 'space'; record: HydratedRecord };

export const canAssign = (
  permix: Permix,
  target: AssignTarget,
  owner: AssignOwner,
  role: Role | null,
  entitlements: NamedEntitlements,
): boolean => {
  const level = assignLevel(role, entitlements, `db:${owner.model}`);
  const holds = (action: string) => check(permix, rebacSchema, owner.model, owner.record, action);
  return (
    check(permix, rebacSchema, target.model, { ...target.record, role: level }, 'assign') &&
    holds(roleToStandardAction(level)) &&
    namedActions(entitlements).every(holds)
  );
};
