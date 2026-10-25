/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import type { Role } from '@template/db/generated/client/enums';
import type { EntitlementEntry, PermissionEntry } from '@template/permissions/client';
import { narrowing } from '@template/permissions/roles/narrowing';
import { uniqBy } from 'lodash-es';

export type DelegateClaim = {
  role: Role | null;
  full: boolean;
  entitlements: EntitlementEntry[] | null;
};

type Position = { resource: string; id: string };

const positionOf = (entry: PermissionEntry): Position | null => {
  if ('from' in entry) return entry.from;
  return entry.id ? { resource: entry.resource, id: entry.id } : null;
};

export const holderPositions = (holder: PermissionEntry[]): Position[] =>
  uniqBy(
    holder.map(positionOf).filter((position): position is Position => position !== null),
    (position) => `${position.resource}:${position.id}`,
  );

const asEntitlement = (entry: PermissionEntry): EntitlementEntry | null => {
  if ('from' in entry) return entry;
  const position = positionOf(entry);
  if (!position) return null;
  const actions = Object.fromEntries(
    Object.entries(entry.actions).filter(([, held]) => held === true),
  ) as Record<string, boolean>;
  return { resource: entry.resource, from: position, actions };
};

/** What a delegate holds, as entitlements over its holder's table: full passes the table through. */
export const delegateClaimEntries = (
  claim: DelegateClaim,
  holder: PermissionEntry[],
): EntitlementEntry[] => {
  if (claim.full)
    return holder.map(asEntitlement).filter((entry): entry is EntitlementEntry => entry !== null);
  const role = claim.role;
  return [
    ...(role
      ? holderPositions(holder).map(({ resource, id }) => narrowing(resource, id, role))
      : []),
    ...(claim.entitlements ?? []),
  ];
};
