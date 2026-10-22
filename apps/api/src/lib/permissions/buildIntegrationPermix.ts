/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses none
 */
import type { OrganizationId, SpaceId, UserId } from '@template/db';
import {
  createPermissions,
  getMembershipPermissions,
  getOrgPermissions,
  getSpacePermissions,
  getUserPermissions,
  type PermissionEntry,
  type Permix,
} from '@template/permissions';
import type { IntegrationWithOwners } from '#/lib/context/types';
import { integrationSelfIds } from '#/lib/permissions/selfIdsOf';
import { setupEntitlements } from '#/lib/permissions/setupEntitlements';
import { validateRole } from '#/lib/permissions/validateRole';

const ownerEntry = (
  integration: IntegrationWithOwners,
  role: ReturnType<typeof validateRole>,
): PermissionEntry | null => {
  switch (integration.ownerModel) {
    case 'User':
      return getUserPermissions(integration.userId as UserId, role);
    case 'Organization':
      return getOrgPermissions(role, integration.organizationId as OrganizationId);
    case 'Space':
      return getSpacePermissions(role, integration.spaceId as SpaceId);
    case 'OrganizationUser':
      return integration.organizationUser
        ? getMembershipPermissions('db:organizationUser', role, integration.organizationUser.id)
        : null;
    case 'SpaceUser':
      return integration.spaceUser
        ? getMembershipPermissions('db:spaceUser', role, integration.spaceUser.id)
        : null;
  }
};

export const buildIntegrationPermix = async (
  integration: IntegrationWithOwners,
): Promise<Permix> => {
  const permix = createPermissions();
  const owner = integration.role ? ownerEntry(integration, validateRole(integration.role)) : null;
  if (owner) await permix.setup(owner);
  await setupEntitlements(permix, integration.entitlements, {
    ownerKey: owner ? `${owner.resource}:${owner.id}` : `db:integration:${integration.id}`,
    selfIds: integrationSelfIds(integration),
  });
  return permix;
};
