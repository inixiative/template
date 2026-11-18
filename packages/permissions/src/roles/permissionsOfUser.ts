/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses none
 */
import type { Role } from '@template/db/generated/client/enums';
import type { EntitlementEntry, Permissions } from '@template/permissions/client';
import {
  type EntitlementFields,
  entitlementEntriesOfHolder,
} from '@template/permissions/entitlementRows';
import {
  isMemberSelfGrant,
  type MemberResource,
} from '@template/permissions/roles/memberSelfGrant';
import { permissionEntryForOrganizationRole } from '@template/permissions/roles/organization';
import { spacePermissionsForRole } from '@template/permissions/roles/space';
import { userPermissionsForUser } from '@template/permissions/roles/user';
import { partition } from 'lodash-es';

type Member = {
  role: Role;
  id?: string;
  userId?: string;
  targetEntitlements?: EntitlementFields[] | null;
};
type OrganizationMember = Member & { organizationId: string };
type SpaceMember = Member & { spaceId: string };

export const organizationOwnerPermissions = (organizationId: string): Permissions => [
  { entries: [permissionEntryForOrganizationRole('owner', organizationId)] },
];

export const spaceOwnerPermissions = (spaceId: string): Permissions => [
  { entries: [spacePermissionsForRole('owner', spaceId)] },
];

const ownedBy = (entries: EntitlementEntry[], owner: Permissions): Permissions =>
  entries.length ? [{ entries, owner }] : [];

const memberPermissions = (
  member: Member,
  resource: MemberResource,
  tenantOwner: Permissions,
): Permissions => {
  const [usersSide, tenantsSide] = partition(
    entitlementEntriesOfHolder(member),
    isMemberSelfGrant(resource, member),
  );
  return [
    ...(member.userId
      ? ownedBy(usersSide, [{ entries: [userPermissionsForUser(member.userId)] }])
      : []),
    ...ownedBy(tenantsSide, tenantOwner),
  ];
};

export const permissionsOfUser = (
  userId: string | null,
  members: OrganizationMember[],
  spaceMembers: SpaceMember[],
): Permissions => [
  {
    entries: [
      ...(userId ? [userPermissionsForUser(userId)] : []),
      ...members.map((member) =>
        permissionEntryForOrganizationRole(member.role, member.organizationId),
      ),
      ...spaceMembers.map((member) => spacePermissionsForRole(member.role, member.spaceId)),
    ],
  },
  ...members.flatMap((member) =>
    memberPermissions(
      member,
      'db:organizationUser',
      organizationOwnerPermissions(member.organizationId),
    ),
  ),
  ...spaceMembers.flatMap((member) =>
    memberPermissions(member, 'db:spaceUser', spaceOwnerPermissions(member.spaceId)),
  ),
];
