/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import type { HydratedRecord } from '@template/db';
import type { Role } from '@template/db/generated/client/enums';
import {
  type Action,
  type ActionState,
  type Entitlements,
  type Permix,
  personOnlyActions,
  SessionAction,
} from '@template/permissions/client';
import { rebacSchema } from '@template/permissions/rebac/schema';
import { membershipRoles } from '@template/permissions/roles/membership';
import { organizationRoles } from '@template/permissions/roles/organization';
import { roleHierarchy } from '@template/permissions/roles/shared';
import { spaceRoles } from '@template/permissions/roles/space';
import { userRoles } from '@template/permissions/roles/user';

export type Grant = { role: Role; entitlements: Entitlements };

export type EntitlementGrant = Grant & { entitlementsOnly: boolean };

export type GrantResource =
  | 'db:user'
  | 'db:organization'
  | 'db:space'
  | 'db:organizationUser'
  | 'db:spaceUser';

export type GrantHolder = Pick<Permix, 'check'>;

export type GrantEntry = { resource: GrantResource; record: HydratedRecord };

const roleActions: Record<GrantResource, (role: Role) => ActionState> = {
  'db:user': (role) => userRoles[role].user,
  'db:organization': (role) => organizationRoles[role].organization,
  'db:space': (role) => spaceRoles[role].space,
  'db:organizationUser': (role) => membershipRoles[role].membership,
  'db:spaceUser': (role) => membershipRoles[role].membership,
};

export const roleAction = (resource: GrantResource, role: Role): string =>
  Object.keys(roleActions[resource](role))[0] as string;

const grantAll = (actions: readonly string[]): Entitlements =>
  actions.length ? Object.fromEntries(actions.map((action) => [action, true])) : null;

export const namedActions = (entitlements: Entitlements | undefined): string[] =>
  Object.keys(entitlements ?? {}).filter((action) => entitlements?.[action] === true);

export const userLoginGrant: Grant = {
  role: 'owner',
  entitlements: grantAll(Object.values(SessionAction)),
};

const personOnly = new Set<string>(personOnlyActions);

// why: a rule-gated action (assign, leave) granted by name would skip its rule, so only a held entry or a plain delegation from one counts
export const holdsUnconditionally = (
  holder: GrantHolder,
  resource: GrantResource,
  id: string,
  action: string,
  seen: Set<string> = new Set(),
): boolean => {
  if (holder.check(resource, action as Action, id)) return true;
  if (seen.has(action)) return false;
  seen.add(action);
  const rule = rebacSchema.permissions[resource]?.actions[action];
  return typeof rule === 'string' && holdsUnconditionally(holder, resource, id, rule, seen);
};

const holds = (holder: GrantHolder, { resource, record }: GrantEntry, action: string) =>
  holdsUnconditionally(holder, resource, String(record.id), action);

export const projectGrant = (
  holder: GrantHolder,
  entry: GrantEntry,
  grant: EntitlementGrant,
): EntitlementGrant => {
  const entitlements = grantAll(
    namedActions(grant.entitlements).filter(
      (action) => !personOnly.has(action) && holds(holder, entry, action),
    ),
  );
  const role = grant.entitlementsOnly
    ? undefined
    : roleHierarchy
        .slice(0, roleHierarchy.indexOf(grant.role) + 1)
        .reverse()
        .find((candidate) => holds(holder, entry, roleAction(entry.resource, candidate)));
  if (!role) return { role: grant.role, entitlements, entitlementsOnly: true };
  return { role, entitlements, entitlementsOnly: false };
};

export const findUnheldGrant = (
  holder: GrantHolder,
  entries: GrantEntry[],
  grant: EntitlementGrant,
): string[] => {
  const [home] = entries;
  if (!home) return ['an entry to hold the grant on'];
  const homeRole = roleAction(home.resource, grant.role);
  const unheldRole =
    !grant.entitlementsOnly && !holds(holder, home, homeRole)
      ? [`${home.resource}:${home.record.id}:${homeRole}`]
      : [];
  const unheldEntitlements = namedActions(grant.entitlements).filter(
    (action) => !entries.some((entry) => holds(holder, entry, action)),
  );
  return [...unheldRole, ...unheldEntitlements];
};
