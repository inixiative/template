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

export const delegateEntries = (
  permissions: DelegatePermissions,
  owner: PermissionEntry[],
): EntitlementEntry[] => {
  const role = permissions.role;
  return [
    ...(role ? ownerAnchors(owner).map(({ resource, id }) => narrowing(resource, id, role)) : []),
    ...(permissions.entitlements ?? []),
  ];
};
