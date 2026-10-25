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

export type DelegatePermissions = {
  role: Role | null;
  full: boolean;
  entitlements: EntitlementEntry[] | null;
};

type Anchor = { resource: string; id: string };

const anchorOf = (entry: PermissionEntry): Anchor | null => {
  if ('anchor' in entry) return entry.anchor;
  return entry.id ? { resource: entry.resource, id: entry.id } : null;
};

const ownerAnchors = (owner: PermissionEntry[]): Anchor[] =>
  uniqBy(
    owner.map(anchorOf).filter((anchor): anchor is Anchor => anchor !== null),
    (anchor) => `${anchor.resource}:${anchor.id}`,
  );

const asEntitlement = (entry: PermissionEntry): EntitlementEntry | null => {
  if ('anchor' in entry) return entry;
  const anchor = anchorOf(entry);
  if (!anchor) return null;
  const actions = Object.fromEntries(
    Object.entries(entry.actions).filter(([, held]) => held === true),
  ) as Record<string, boolean>;
  return { resource: entry.resource, anchor, actions };
};

export const delegateEntries = (
  permissions: DelegatePermissions,
  owner: PermissionEntry[],
): EntitlementEntry[] => {
  if (permissions.full)
    return owner.map(asEntitlement).filter((entry): entry is EntitlementEntry => entry !== null);
  const role = permissions.role;
  return [
    ...(role ? ownerAnchors(owner).map(({ resource, id }) => narrowing(resource, id, role)) : []),
    ...(permissions.entitlements ?? []),
  ];
};
