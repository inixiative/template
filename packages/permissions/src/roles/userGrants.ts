/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import type { Role } from '@template/db/generated/client/enums';
import {
  type EntitlementEntry,
  type Permissions,
  wellFormedEntitlements,
} from '@template/permissions/client';
import {
  isMemberSelfGrant,
  type MemberResource,
} from '@template/permissions/roles/memberSelfGrant';
import { getOrgPermissions } from '@template/permissions/roles/organization';
import { getSpacePermissions } from '@template/permissions/roles/space';
import { getUserPermissions } from '@template/permissions/roles/user';
import { partition } from 'lodash-es';

type Member = { role: Role; id?: string; userId?: string; entitlements?: unknown };
type OrganizationMember = Member & { organizationId: string };
type SpaceMember = Member & { spaceId: string };

export const organizationOwnerGrants = (organizationId: string): Permissions => [
  { entries: [getOrgPermissions('owner', organizationId)] },
];

export const spaceOwnerGrants = (spaceId: string): Permissions => [
  { entries: [getSpacePermissions('owner', spaceId)] },
];

const ownedBy = (entries: EntitlementEntry[], owner: Permissions): Permissions =>
  entries.length ? [{ entries, owner }] : [];

const memberGrants = (
  member: Member,
  resource: MemberResource,
  tenantOwner: Permissions,
): Permissions => {
  const [usersSide, tenantsSide] = partition(
    wellFormedEntitlements(member.entitlements),
    isMemberSelfGrant(resource, member),
  );
  return [
    ...(member.userId
      ? ownedBy(usersSide, [{ entries: [getUserPermissions(member.userId)] }])
      : []),
    ...ownedBy(tenantsSide, tenantOwner),
  ];
};

export const userGrants = (
  userId: string | null,
  members: OrganizationMember[],
  spaceMembers: SpaceMember[],
): Permissions => [
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
