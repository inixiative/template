/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import type { OrganizationId, SpaceId, UserId } from '@template/db';
import type { Role } from '@template/db/generated/client/enums';
import type { Entitlements, PermissionEntry } from '@template/permissions/client';
import { getOrgPermissions } from '@template/permissions/roles/organization';
import { getSpacePermissions } from '@template/permissions/roles/space';
import { getUserPermissions } from '@template/permissions/roles/user';

type OrganizationMember = { role: Role; organizationId: string; entitlements?: unknown };
type SpaceMember = { role: Role; spaceId: string; entitlements?: unknown };

export const userEntries = (
  userId: string | null,
  members: OrganizationMember[],
  spaceMembers: SpaceMember[],
): PermissionEntry[] => [
  ...(userId ? [getUserPermissions(userId as UserId)] : []),
  ...members.map((member) =>
    getOrgPermissions(
      member.role,
      member.organizationId as OrganizationId,
      member.entitlements as Entitlements,
    ),
  ),
  ...spaceMembers.map((member) =>
    getSpacePermissions(
      member.role,
      member.spaceId as SpaceId,
      member.entitlements as Entitlements,
    ),
  ),
];
