/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import { Operator } from '@inixiative/json-rules';
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

type OrganizationMember = {
  id: string;
  role: Role;
  organizationId: string;
  entitlements?: unknown;
};
type SpaceMember = { id: string; role: Role; spaceId: string; entitlements?: unknown };

const ownsItsIntegrations = (
  memberModel: 'OrganizationUser' | 'SpaceUser',
  id: string,
): EntitlementEntry => {
  const path = memberModel === 'OrganizationUser' ? 'organizationUser' : 'spaceUser';
  return {
    resource: 'db:integration',
    anchor: { resource: `db:${path}`, id, path },
    actions: { own: true, manage: true, operate: true, read: true },
    where: { field: 'ownerModel', operator: Operator.equals, value: memberModel },
  };
};

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
      [
        ownsItsIntegrations('OrganizationUser', member.id),
        ...wellFormedEntitlements(member.entitlements),
      ],
      organizationOwnerGrants(member.organizationId),
    ),
  ),
  ...spaceMembers.flatMap((member) =>
    ownedBy(
      [ownsItsIntegrations('SpaceUser', member.id), ...wellFormedEntitlements(member.entitlements)],
      spaceOwnerGrants(member.spaceId),
    ),
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
