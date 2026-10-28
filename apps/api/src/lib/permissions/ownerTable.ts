/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type {
  IntegrationOwnerModel,
  OrganizationUser,
  Role,
  SpaceUser,
  TokenOwnerModel,
} from '@template/db/generated/client/client';
import {
  type DelegatePermissions,
  delegateEntries,
  type Grant,
  organizationOwnerGrants,
  spaceOwnerGrants,
  userGrants,
} from '@template/permissions';
import { parseEntitlements } from '@template/permissions/rebac';
import { findUserWithRelations } from '#/modules/user/services/find';

export type OwnerTable = Grant[];

type PermissionsRow = { role?: Role | null; full?: boolean; entitlements?: unknown };

type Delegated = {
  ownerModel: TokenOwnerModel | IntegrationOwnerModel;
  userId: string | null;
  organizationId: string | null;
  spaceId: string | null;
  organizationUser?: OrganizationUser | null;
  spaceUser?: SpaceUser | null;
  integration?: (Delegated & PermissionsRow) | null;
};

export const delegatePermissionsOf = (row: PermissionsRow): DelegatePermissions => ({
  role: row.role ?? null,
  full: row.full ?? false,
  entitlements: parseEntitlements(row.entitlements) as DelegatePermissions['entitlements'],
});

const nobody: OwnerTable = [];

export const delegateTable = (delegate: PermissionsRow, owner: OwnerTable): OwnerTable =>
  delegate.full
    ? owner
    : [
        {
          entries: delegateEntries(
            delegatePermissionsOf(delegate),
            owner.flatMap((grant) => grant.entries),
          ),
          owner,
        },
      ];

export const ownerTable = async (delegated: Delegated): Promise<OwnerTable> => {
  const { organizationId, spaceId, userId, organizationUser, spaceUser, integration } = delegated;
  switch (delegated.ownerModel) {
    case 'User': {
      const user = userId ? await findUserWithRelations(userId) : null;
      return user ? userGrants(user.id, user.organizationUsers, user.spaceUsers) : nobody;
    }
    case 'OrganizationUser':
      return organizationUser ? userGrants(null, [organizationUser], []) : nobody;
    case 'SpaceUser':
      return spaceUser ? userGrants(null, [], [spaceUser]) : nobody;
    case 'Organization':
      return organizationId ? organizationOwnerGrants(organizationId) : nobody;
    case 'Space':
      return spaceId ? spaceOwnerGrants(spaceId) : nobody;
    case 'Integration':
      return integration ? delegateTable(integration, await ownerTable(integration)) : nobody;
  }
};
