/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import type { AccessorName, HydratedRecord } from '@template/db';
import type { Role } from '@template/db/generated/client/enums';
import type { Entitlements, Permix } from '@template/permissions/client';
import { type GrantResource, grantReaches } from '@template/permissions/grant';
import { check } from '@template/permissions/rebac/check';
import { rebacSchema } from '@template/permissions/rebac/schema';
import {
  greaterRole,
  roleHierarchy,
  roleToStandardAction,
} from '@template/permissions/roles/shared';

const actionLevel = (resource: GrantResource, action: string): Role => {
  const reachedBy = roleHierarchy.find((role) =>
    grantReaches(resource, { role, entitlements: null }, action),
  );
  if (reachedBy) return reachedBy;
  return rebacSchema.permissions[resource]?.actions[action] === undefined ? 'member' : 'owner';
};

const namedActions = (entitlements: Entitlements | undefined) =>
  Object.keys(entitlements ?? {}).filter((action) => entitlements?.[action] === true);

export const assignLevel = (
  role: Role | null,
  entitlements: Entitlements | undefined,
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
  entitlements: Entitlements | undefined,
): boolean => {
  const level = assignLevel(role, entitlements, `db:${owner.model}`);
  const holds = (action: string) => check(permix, rebacSchema, owner.model, owner.record, action);
  return (
    check(permix, rebacSchema, target.model, { ...target.record, role: level }, 'assign') &&
    holds(roleToStandardAction(level)) &&
    namedActions(entitlements).every(holds)
  );
};
