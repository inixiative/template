/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import type { OrganizationId, SpaceId, UserId } from '@template/db';
import type { Role } from '@template/db/generated/client/enums';
import {
  createPermissions,
  type EntitlementEntry,
  type PermissionEntry,
  type Permix,
} from '@template/permissions/client';
import { getOrgPermissions } from '@template/permissions/roles/organization';
import { getSpacePermissions } from '@template/permissions/roles/space';
import { getUserPermissions } from '@template/permissions/roles/user';
import { wellFormedEntitlements } from '@template/permissions/roles/wellFormedEntitlements';

export type Grant = { entries: PermissionEntry[]; owner?: Grant[] };

type OrganizationMember = { role: Role; organizationId: string; entitlements?: unknown };
type SpaceMember = { role: Role; spaceId: string; entitlements?: unknown };

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
    ownedBy(
      wellFormedEntitlements(member.entitlements),
      organizationOwnerGrants(member.organizationId),
    ),
  ),
  ...spaceMembers.flatMap((member) =>
    ownedBy(wellFormedEntitlements(member.entitlements), spaceOwnerGrants(member.spaceId)),
  ),
];

export const installGrants = async (permix: Permix, grants: Grant[]): Promise<void> => {
  for (const { entries, owner } of grants)
    await permix.setup(entries, owner ? { owner: await grantsPermix(owner) } : undefined);
};

export const grantsPermix = async (grants: Grant[]): Promise<Permix> => {
  const permix = createPermissions();
  await installGrants(permix, grants);
  return permix;
};
