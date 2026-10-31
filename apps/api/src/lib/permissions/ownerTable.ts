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
  delegate,
  organizationOwnerGrants,
  type Permissions,
  rebacSchema,
  roleToStandardAction,
  spaceOwnerGrants,
  userGrants,
  wellFormedEntitlements,
} from '@template/permissions';
import { findUserWithRelations } from '#/modules/user/services/find';

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

const nobody: Permissions = [];

export const delegateTable = (delegated: PermissionsRow, owner: Permissions): Permissions =>
  delegate(rebacSchema, owner, {
    full: delegated.full,
    ceiling: delegated.role ? roleToStandardAction(delegated.role) : undefined,
    entitlements: wellFormedEntitlements(delegated.entitlements),
  });

export const ownerTable = async (delegated: Delegated): Promise<Permissions> => {
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
