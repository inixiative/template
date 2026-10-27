/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import { Operator } from '@inixiative/json-rules';
import {
  type AccessorName,
  type OrganizationId,
  placedUnder,
  type SpaceId,
  type UserId,
} from '@template/db';
import type { Role } from '@template/db/generated/client/enums';
import {
  createPermissions,
  type EntitlementEntry,
  type PermissionEntry,
  type Permix,
} from '@template/permissions/client';
import { parseEntitlements } from '@template/permissions/rebac/entitlementEntrySchema';
import { getOrgPermissions } from '@template/permissions/roles/organization';
import { getSpacePermissions } from '@template/permissions/roles/space';
import { getUserPermissions } from '@template/permissions/roles/user';

export type Grant = { entries: PermissionEntry[]; owner?: Grant[] };

type OrganizationMember = { role: Role; organizationId: string; entitlements?: unknown };
type SpaceMember = { role: Role; spaceId: string; entitlements?: unknown };

const entitlementsOf = (member: { entitlements?: unknown }): EntitlementEntry[] =>
  (parseEntitlements(member.entitlements) ?? []) as EntitlementEntry[];

export const organizationOwnerGrants = (organizationId: string): Grant[] => [
  { entries: [getOrgPermissions('owner', organizationId as OrganizationId)] },
];

export const spaceOwnerGrants = (spaceId: string): Grant[] => [
  { entries: [getSpacePermissions('owner', spaceId as SpaceId)] },
];

const ownedBy = (entries: EntitlementEntry[], owner: Grant[]): Grant[] =>
  entries.length ? [{ entries, owner }] : [];

export const userGrants = (
  userId: string | null,
  members: OrganizationMember[],
  spaceMembers: SpaceMember[],
): Grant[] => [
  {
    entries: [
      ...(userId ? [getUserPermissions(userId as UserId)] : []),
      ...members.map((member) =>
        getOrgPermissions(member.role, member.organizationId as OrganizationId),
      ),
      ...spaceMembers.map((member) => getSpacePermissions(member.role, member.spaceId as SpaceId)),
    ],
  },
  ...members.flatMap((member) =>
    ownedBy(entitlementsOf(member), organizationOwnerGrants(member.organizationId)),
  ),
  ...spaceMembers.flatMap((member) =>
    ownedBy(entitlementsOf(member), spaceOwnerGrants(member.spaceId)),
  ),
];

const accessorOf = (resource: string) => resource.slice('db:'.length) as AccessorName;

export const atAnchor = (entry: PermissionEntry): PermissionEntry => {
  if (!('anchor' in entry) || !entry.anchor) return entry;
  const { resource, anchor, where } = entry as EntitlementEntry;
  const placement =
    resource === anchor.resource
      ? { field: 'id', operator: Operator.equals, value: anchor.id }
      : (placedUnder(accessorOf(resource), accessorOf(anchor.resource), anchor.id) ?? false);
  return { ...entry, where: where === undefined ? placement : { all: [placement, where] } };
};

export const installGrants = async (permix: Permix, grants: Grant[]): Promise<void> => {
  for (const { entries, owner } of grants)
    await permix.setup(
      entries.map(atAnchor),
      owner ? { owner: await grantsPermix(owner) } : undefined,
    );
};

export const grantsPermix = async (grants: Grant[]): Promise<Permix> => {
  const permix = createPermissions();
  await installGrants(permix, grants);
  return permix;
};
