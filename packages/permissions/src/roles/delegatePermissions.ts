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

type Reach = { resource: string; anchor: { resource: string; id: string; path?: string } };

const reachOf = (entry: PermissionEntry): Reach | null => {
  if ('anchor' in entry) return { resource: entry.resource, anchor: entry.anchor };
  return entry.id
    ? { resource: entry.resource, anchor: { resource: entry.resource, id: entry.id } }
    : null;
};

const ownerReach = (owner: PermissionEntry[]): Reach[] =>
  uniqBy(
    owner.map(reachOf).filter((reach): reach is Reach => reach !== null),
    ({ resource, anchor }) => `${resource}@${anchor.resource}:${anchor.id}:${anchor.path ?? ''}`,
  );

export const delegateEntries = (
  permissions: DelegatePermissions,
  owner: PermissionEntry[],
): EntitlementEntry[] => {
  const role = permissions.role;
  return [
    ...(role
      ? ownerReach(owner).map(({ resource, anchor }) => narrowing(resource, anchor, role))
      : []),
    ...(permissions.entitlements ?? []),
  ];
};
