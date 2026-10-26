/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { OrganizationId, SpaceId } from '@template/db';
import type {
  IntegrationOwnerModel,
  OrganizationUser,
  Role,
  SpaceUser,
  TokenOwnerModel,
} from '@template/db/generated/client/client';
import {
  createPermissions,
  type DelegatePermissions,
  delegateEntries,
  getOrgPermissions,
  getSpacePermissions,
  type PermissionEntry,
  type Permix,
  userEntries,
} from '@template/permissions';
import { entitlementEntriesSchema } from '@template/permissions/rebac';
import { findUserWithRelations } from '#/modules/user/services/find';

export type OwnerTable = { entries: PermissionEntry[]; owner?: Permix };

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
  entitlements:
    row.entitlements === null || row.entitlements === undefined
      ? null
      : (entitlementEntriesSchema.parse(row.entitlements) as DelegatePermissions['entitlements']),
});

const ownerPermix = async (table: OwnerTable): Promise<Permix> => {
  const permix = createPermissions();
  await permix.setup(table.entries, table.owner ? { owner: table.owner } : undefined);
  return permix;
};

const nobody: OwnerTable = { entries: [] };

export const delegateTable = async (
  delegate: PermissionsRow,
  owner: OwnerTable,
): Promise<OwnerTable> =>
  delegate.full
    ? owner
    : {
        entries: delegateEntries(delegatePermissionsOf(delegate), owner.entries),
        owner: await ownerPermix(owner),
      };

export const ownerTable = async (delegated: Delegated): Promise<OwnerTable> => {
  const { organizationId, spaceId, userId, organizationUser, spaceUser, integration } = delegated;
  switch (delegated.ownerModel) {
    case 'User': {
      const user = userId ? await findUserWithRelations(userId) : null;
      return user
        ? { entries: userEntries(user.id, user.organizationUsers, user.spaceUsers) }
        : nobody;
    }
    case 'OrganizationUser':
      return organizationUser ? { entries: userEntries(null, [organizationUser], []) } : nobody;
    case 'SpaceUser':
      return spaceUser ? { entries: userEntries(null, [], [spaceUser]) } : nobody;
    case 'Organization':
      return organizationId
        ? { entries: [getOrgPermissions('owner', organizationId as OrganizationId)] }
        : nobody;
    case 'Space':
      return spaceId ? { entries: [getSpacePermissions('owner', spaceId as SpaceId)] } : nobody;
    case 'Integration':
      return integration ? delegateTable(integration, await ownerTable(integration)) : nobody;
  }
};
