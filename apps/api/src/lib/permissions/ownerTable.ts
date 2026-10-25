/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import { fetchOne, type OrganizationId, type SpaceId, type UserId } from '@template/db';
import type {
  Integration,
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
  type Entitlements,
  getOrgPermissions,
  getSpacePermissions,
  getUserPermissions,
  type PermissionEntry,
  type Permix,
} from '@template/permissions';
import { entitlementEntriesSchema } from '@template/permissions/rebac';
import { validateRole } from '#/lib/permissions/validateRole';
import { findUserWithRelations } from '#/modules/user/services/find';

export type OwnerTable = { entries: PermissionEntry[]; owner?: Permix };

type Delegated = {
  ownerModel: TokenOwnerModel | IntegrationOwnerModel;
  userId: string | null;
  organizationId: string | null;
  spaceId: string | null;
  integrationId?: string | null;
};

type PermissionsRow = { role?: Role | null; full?: boolean; entitlements?: unknown };

const memberEntry = (seat: OrganizationUser): PermissionEntry =>
  getOrgPermissions(
    validateRole(seat.role),
    seat.organizationId as OrganizationId,
    seat.entitlements as Entitlements,
  );

const spaceMemberEntry = (seat: SpaceUser): PermissionEntry =>
  getSpacePermissions(
    validateRole(seat.role),
    seat.spaceId as SpaceId,
    seat.entitlements as Entitlements,
  );

export const userEntries = (
  userId: string | null,
  seats: OrganizationUser[],
  spaceSeats: SpaceUser[],
): PermissionEntry[] => [
  ...(userId ? [getUserPermissions(userId as UserId)] : []),
  ...seats.map(memberEntry),
  ...spaceSeats.map(spaceMemberEntry),
];

export const delegatePermissionsOf = (row: PermissionsRow): DelegatePermissions => ({
  role: row.role ? validateRole(row.role) : null,
  full: row.full ?? false,
  entitlements:
    row.entitlements === null || row.entitlements === undefined
      ? null
      : (entitlementEntriesSchema.parse(row.entitlements) as DelegatePermissions['entitlements']),
});

export const ownerPermix = async (table: OwnerTable): Promise<Permix> => {
  const permix = createPermissions();
  await permix.setup(table.entries, table.owner ? { owner: table.owner } : undefined);
  return permix;
};

const nobody: OwnerTable = { entries: [] };

export const ownerTable = async (delegated: Delegated): Promise<OwnerTable> => {
  const { organizationId, spaceId, userId, integrationId } = delegated;
  switch (delegated.ownerModel) {
    case 'User': {
      const person = userId ? await findUserWithRelations(userId) : null;
      return person
        ? { entries: userEntries(person.id, person.organizationUsers, person.spaceUsers) }
        : nobody;
    }
    case 'OrganizationUser': {
      const seat =
        organizationId && userId
          ? await fetchOne<OrganizationUser>('organizationUser', { organizationId, userId })
          : null;
      return seat ? { entries: [memberEntry(seat)] } : nobody;
    }
    case 'SpaceUser': {
      const seat =
        organizationId && spaceId && userId
          ? await fetchOne<SpaceUser>('spaceUser', { organizationId, spaceId, userId })
          : null;
      return seat ? { entries: [spaceMemberEntry(seat)] } : nobody;
    }
    case 'Organization':
      return organizationId
        ? { entries: [getOrgPermissions('owner', organizationId as OrganizationId)] }
        : nobody;
    case 'Space':
      return spaceId ? { entries: [getSpacePermissions('owner', spaceId as SpaceId)] } : nobody;
    case 'Integration': {
      const integration = integrationId
        ? await fetchOne<Integration>('integration', integrationId)
        : null;
      if (!integration) return nobody;
      const owner = await ownerTable(integration);
      return {
        entries: delegateEntries(delegatePermissionsOf(integration), owner.entries),
        owner: await ownerPermix(owner),
      };
    }
  }
};
