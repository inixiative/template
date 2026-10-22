/**
 * @atlas
 * @kind registry
 * @partOf primitive:authz
 * @uses feature:tenancy
 */
import type { Role } from '@template/db/generated/client/enums';
import type { PermissionEntry } from '@template/permissions/client';

export type MembershipResource = 'db:organizationUser' | 'db:spaceUser';

export const membershipRoles = {
  owner: { membership: { 'membership.own': true } },
  admin: { membership: { 'membership.manage': true } },
  member: { membership: { 'membership.operate': true } },
  viewer: { membership: { 'membership.read': true } },
} as const;

export const getMembershipPermissions = (
  resource: MembershipResource,
  role: Role,
  membershipId: string,
): PermissionEntry => ({
  resource,
  id: membershipId,
  actions: membershipRoles[role].membership,
});
