/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import type { Role } from '@template/db/generated/client/enums';
import {
  createPermissions,
  type EntitlementEntry,
  type PermissionEntry,
  type Permix,
} from '@template/permissions/client';
import {
  isMemberSelfGrant,
  type MemberResource,
} from '@template/permissions/roles/memberSelfGrant';
import { getOrgPermissions } from '@template/permissions/roles/organization';
import { getSpacePermissions } from '@template/permissions/roles/space';
import { getUserPermissions } from '@template/permissions/roles/user';
import { wellFormedEntitlements } from '@template/permissions/roles/wellFormedEntitlements';
import { partition } from 'lodash-es';

export type Grant = { entries: PermissionEntry[]; owner?: Grant[] };

type Member = { role: Role; id?: string; userId?: string; entitlements?: unknown };
type OrganizationMember = Member & { organizationId: string };
type SpaceMember = Member & { spaceId: string };

export const organizationOwnerGrants = (organizationId: string): Grant[] => [
  { entries: [getOrgPermissions('owner', organizationId)] },
];

export const spaceOwnerGrants = (spaceId: string): Grant[] => [
  { entries: [getSpacePermissions('owner', spaceId)] },
];

const ownedBy = (entries: EntitlementEntry[], owner: Grant[]): Grant[] =>
  entries.length ? [{ entries, owner }] : [];

const memberGrants = (member: Member, resource: MemberResource, tenantOwner: Grant[]): Grant[] => {
  const [usersSide, tenantsSide] = partition(
    wellFormedEntitlements(member.entitlements),
    isMemberSelfGrant(resource, member),
  );
  return [
    ...ownedBy(usersSide, [{ entries: [getUserPermissions(member.userId as UserId)] }]),
    ...ownedBy(tenantsSide, tenantOwner),
  ];
};

export const userGrants = (
  userId: string | null,
  members: OrganizationMember[],
  spaceMembers: SpaceMember[],
): Grant[] => [
  {
    entries: [
      ...(userId ? [getUserPermissions(userId)] : []),
      ...members.map((member) => getOrgPermissions(member.role, member.organizationId)),
      ...spaceMembers.map((member) => getSpacePermissions(member.role, member.spaceId)),
    ],
  },
  ...members.flatMap((member) =>
    memberGrants(member, 'db:organizationUser', organizationOwnerGrants(member.organizationId)),
  ),
  ...spaceMembers.flatMap((member) =>
    memberGrants(member, 'db:spaceUser', spaceOwnerGrants(member.spaceId)),
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
