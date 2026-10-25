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
  type DelegateClaim,
  delegateClaimEntries,
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

export type DelegateHolder = { entries: PermissionEntry[]; owner?: Permix };

type Delegated = {
  ownerModel: TokenOwnerModel | IntegrationOwnerModel;
  userId: string | null;
  organizationId: string | null;
  spaceId: string | null;
  integrationId?: string | null;
};

type ClaimRow = { role?: Role | null; full?: boolean; entitlements?: unknown };

const seatEntry = (seat: OrganizationUser): PermissionEntry =>
  getOrgPermissions(
    validateRole(seat.role),
    seat.organizationId as OrganizationId,
    seat.entitlements as Entitlements,
  );

const spaceSeatEntry = (seat: SpaceUser): PermissionEntry =>
  getSpacePermissions(
    validateRole(seat.role),
    seat.spaceId as SpaceId,
    seat.entitlements as Entitlements,
  );

export const personEntries = (
  userId: string | null,
  seats: OrganizationUser[],
  spaceSeats: SpaceUser[],
): PermissionEntry[] => [
  ...(userId ? [getUserPermissions(userId as UserId)] : []),
  ...seats.map(seatEntry),
  ...spaceSeats.map(spaceSeatEntry),
];

export const delegateClaimOf = (row: ClaimRow): DelegateClaim => ({
  role: row.role ? validateRole(row.role) : null,
  full: row.full ?? false,
  entitlements:
    row.entitlements === null || row.entitlements === undefined
      ? null
      : (entitlementEntriesSchema.parse(row.entitlements) as DelegateClaim['entitlements']),
});

export const holderPermix = async (holder: DelegateHolder): Promise<Permix> => {
  const permix = createPermissions();
  await permix.setup(holder.entries, holder.owner ? { owner: holder.owner } : undefined);
  return permix;
};

const nobody: DelegateHolder = { entries: [] };

export const delegateHolder = async (delegated: Delegated): Promise<DelegateHolder> => {
  const { organizationId, spaceId, userId, integrationId } = delegated;
  switch (delegated.ownerModel) {
    case 'User': {
      const person = userId ? await findUserWithRelations(userId) : null;
      return person
        ? { entries: personEntries(person.id, person.organizationUsers, person.spaceUsers) }
        : nobody;
    }
    case 'OrganizationUser': {
      const seat =
        organizationId && userId
          ? await fetchOne<OrganizationUser>('organizationUser', { organizationId, userId })
          : null;
      return seat ? { entries: [seatEntry(seat)] } : nobody;
    }
    case 'SpaceUser': {
      const seat =
        organizationId && spaceId && userId
          ? await fetchOne<SpaceUser>('spaceUser', { organizationId, spaceId, userId })
          : null;
      return seat ? { entries: [spaceSeatEntry(seat)] } : nobody;
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
      const owner = await delegateHolder(integration);
      return {
        entries: delegateClaimEntries(delegateClaimOf(integration), owner.entries),
        owner: await holderPermix(owner),
      };
    }
  }
};
