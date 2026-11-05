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
  organizationOwnerPermissions,
  type Permissions,
  permissionsOfUser,
  rebacSchema,
  roleToStandardAction,
  spaceOwnerPermissions,
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

export const delegatedPermissions = (delegated: PermissionsRow, owner: Permissions): Permissions =>
  delegate(rebacSchema, owner, {
    full: delegated.full,
    ceiling: delegated.role ? roleToStandardAction(delegated.role) : undefined,
    entitlements: wellFormedEntitlements(delegated.entitlements),
  });

export const ownerPermissions = async (delegated: Delegated): Promise<Permissions> => {
  const { organizationId, spaceId, userId, organizationUser, spaceUser, integration } = delegated;
  switch (delegated.ownerModel) {
    case 'User': {
      const user = userId ? await findUserWithRelations(userId) : null;
      return user ? permissionsOfUser(user.id, user.organizationUsers, user.spaceUsers) : nobody;
    }
    case 'OrganizationUser':
      return organizationUser ? permissionsOfUser(null, [organizationUser], []) : nobody;
    case 'SpaceUser':
      return spaceUser ? permissionsOfUser(null, [], [spaceUser]) : nobody;
    case 'Organization':
      return organizationId ? organizationOwnerPermissions(organizationId) : nobody;
    case 'Space':
      return spaceId ? spaceOwnerPermissions(spaceId) : nobody;
    case 'Integration':
      return integration
        ? delegatedPermissions(integration, await ownerPermissions(integration))
        : nobody;
  }
};
