import type { OrganizationId, SpaceId } from '@template/db';
import {
  type Entitlements,
  type SpaceRole,
  intersectEntitlements,
  lesserRole,
  setupSpaceContext,
} from '@template/permissions';
import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';

/**
 * Set up permissions for user's explicit space memberships at auth time.
 * Stores organizationId in context for inheritance checks.
 *
 * Note: Org owner → space inheritance is handled at check time by
 * checkSpacePermission(), not here. This avoids querying all spaces upfront.
 */
export const setupSpacePermissions = async (c: Context<AppEnv>) => {
  const permix = c.get('permix');
  const token = c.get('token');
  const spaceUsers = c.get('spaceUsers');

  // Space token → single space, token permissions only
  if (token?.ownerModel === 'Space' && token.spaceId) {
    const organizationId = token.space?.organizationId as OrganizationId | undefined;
    await setupSpaceContext(permix, {
      role: token.role as SpaceRole,
      spaceId: token.spaceId as SpaceId,
      entitlements: token.entitlements as Entitlements,
      organizationId,
    });
    return;
  }

  // SpaceUser token → single space, lesser of spaceUser + token
  if (token?.ownerModel === 'SpaceUser' && token.spaceId) {
    const spaceUser = spaceUsers?.find((su) => su.spaceId === token.spaceId);
    if (spaceUser) {
      const organizationId = spaceUser.space?.organizationId as OrganizationId | undefined;
      await setupSpaceContext(permix, {
        role: lesserRole(spaceUser.role as SpaceRole, token.role as SpaceRole),
        spaceId: token.spaceId as SpaceId,
        entitlements: intersectEntitlements(
          spaceUser.entitlements as Entitlements,
          token.entitlements as Entitlements,
        ),
        organizationId,
      });
    }
    return;
  }

  // No explicit space memberships → nothing to set up
  // (Org owner inheritance is handled at check time)
  if (!spaceUsers?.length) return;

  // User token or session → all explicit space memberships
  for (const spaceUser of spaceUsers) {
    const spaceId = spaceUser.spaceId as SpaceId;
    const organizationId = spaceUser.space?.organizationId as OrganizationId | undefined;
    const role = token
      ? lesserRole(spaceUser.role as SpaceRole, token.role as SpaceRole)
      : (spaceUser.role as SpaceRole);
    const entitlements = token
      ? intersectEntitlements(spaceUser.entitlements as Entitlements, token.entitlements as Entitlements)
      : (spaceUser.entitlements as Entitlements);

    await setupSpaceContext(permix, { role, spaceId, entitlements, organizationId });
  }
};
